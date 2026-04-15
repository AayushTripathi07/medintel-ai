const mongoose = require('mongoose');
const axios = require('axios');
const Conversation = require('../models/Conversation');
const LLMService = require('../services/LLMService');
const RetrievalService = require('../services/RetrievalService');

exports.sendMessage = async (req, res) => {
    const { message, conversationId, userContext } = req.body;

    try {
        let conversation;
        if (conversationId) {
            conversation = await Conversation.findById(conversationId);
        }

        if (!conversation) {
            conversation = new Conversation({
                userContext: userContext || {},
                messages: []
            });
        }

        // 1. Expand Query (Aware of Conversation History)
        const expandedQuery = await LLMService.expandQuery(
            {
                disease: conversation.userContext.disease || 'General Medical',
                intent: message,
                location: conversation.userContext.location
            },
            conversation.messages
        );

        // 2. Retrieve Data
        const { publications, trials } = await RetrievalService.searchAll(
            expandedQuery, 
            conversation.userContext.disease,
            conversation.userContext
        );

        // 3. Synthesize Response (With Dialogue Memory)
        const synthesis = await LLMService.synthesizeResearch(
            message,
            publications,
            trials,
            conversation.userContext,
            conversation.messages
        );

        // 4. Save to DB (Graceful if MongoDB is broken or turned off)
        const assistantMessage = {
            role: 'assistant',
            content: synthesis,
            sources: [
                ...publications.slice(0, 4),
                ...trials.slice(0, 4)
            ],
            timestamp: new Date()
        };

        try {
            conversation.messages.push({ role: 'user', content: message, timestamp: new Date() });
            conversation.messages.push(assistantMessage);
            conversation.updatedAt = new Date();
            await conversation.save();
        } catch (dbError) {
            console.warn("MongoDB Save Failed (In-Memory Fallback Active):", dbError.message);
        }

        res.json({
            conversationId: conversation._id || Date.now().toString(),
            response: synthesis,
            sources: assistantMessage.sources,
            expandedQuery
        });

    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
};

exports.getHistory = async (req, res) => {
    try {
        // Return empty history if DB is not connected
        if (mongoose.connection.readyState !== 1) {
            return res.json([]);
        }
        const conversations = await Conversation.find().sort({ updatedAt: -1 }).limit(10);
        res.json(conversations || []);
    } catch (error) {
        res.json([]);
    }
};

exports.getConversation = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(404).json({ error: 'Database unavailable' });
        }
        const conversation = await Conversation.findById(req.params.id);
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
        res.json(conversation);
    } catch (error) {
        res.status(404).json({ error: 'Conversation not found' });
    }
};

exports.getHealth = async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
        
        // Simple connectivity probe for Ollama (local)
        let ollamaStatus = 'Unavailable';
        try {
            const ollamaCheck = await axios.get('http://127.0.0.1:11434/api/tags', { timeout: 2000 });
            if (ollamaCheck.status === 200) ollamaStatus = 'Active';
        } catch (e) {}

        const hfStatus = (process.env.HF_API_TOKEN && process.env.HF_API_TOKEN.length > 10) ? 'Available' : 'Missing';
        
        res.json({
            database: dbStatus,
            ollama: ollamaStatus,
            huggingface: hfStatus,
            mode: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(500).json({ error: 'Health check failed' });
    }
};
