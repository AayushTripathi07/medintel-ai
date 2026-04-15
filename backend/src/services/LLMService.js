const axios = require('axios');
require('dotenv').config();

class LLMService {
    constructor() {
        // Ollama Config (Primary - Local & Private)
        // If on Vercel, we can use an Ngrok tunnel to reach the local Mac
        const tunnelBase = process.env.OLLAMA_TUNNEL_URL ? process.env.OLLAMA_TUNNEL_URL.replace(/\/$/, '') : null;
        this.ollamaUrl = tunnelBase 
            ? `${tunnelBase}/api/chat`
            : 'http://127.0.0.1:11434/api/chat';
        
        if (tunnelBase) {
            console.log(`[LLM] Bridge Protocol Active: Tunneling to ${this.ollamaUrl}`);
        }
        // Using Zephyr as a reliable fallback model
        this.hfModel = 'HuggingFaceH4/zephyr-7b-beta';
        this.hfUrl = `https://api-inference.huggingface.co/models/${this.hfModel}`;
    }

    async callLLM(messages, temperature = 0.7) {
        // ATTEMPT 1: OLLAMA (Primary Local)
        try {
            console.log(`[LLM] Attempting local Ollama inference (${this.ollamaModel})...`);
            const response = await axios.post(
                this.ollamaUrl,
                { 
                    model: this.ollamaModel, 
                    messages: messages, 
                    stream: false, 
                    options: { temperature: temperature } 
                },
                { 
                    timeout: 30000,
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                }
            );
            return response.data.message.content;
        } catch (error) {
            console.warn(`[LLM] Ollama failed: ${error.message}`);
        }

        // ATTEMPT 2: HUGGING FACE (Cloud Fallback)
        if (this.hfApiKey && this.hfApiKey !== 'your_hugging_face_token_here') {
            try {
                // Switching to a model that is universally available on the free tier
                const robustModel = 'HuggingFaceH4/zephyr-7b-beta';
                const robustUrl = `https://api-inference.huggingface.co/models/${robustModel}`;
                
                console.log(`[LLM] Attempting Hugging Face fallback (${robustModel})...`);
                const promptString = messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n') + '\n[ASSISTANT]:';
                
                const response = await axios.post(
                    robustUrl,
                    { 
                        inputs: `<|system|>\n${messages[0].content}</s>\n<|user|>\n${messages.slice(1).map(m => m.content).join('\n')}</s>\n<|assistant|>\n`, 
                        parameters: { max_new_tokens: 1024, temperature, return_full_text: false } 
                    },
                    { 
                        headers: { Authorization: `Bearer ${this.hfApiKey}`, 'Content-Type': 'application/json' },
                        timeout: 30000 
                    }
                );
                
                if (response.data && response.data[0]) {
                    return response.data[0].generated_text;
                }
                
                if (response.data && response.data.generated_text) {
                    return response.data.generated_text;
                }
                
                throw new Error('Unexpected response format from HF');
            } catch (error) {
                console.error(`[LLM] Hugging Face failed: ${error.message}`);
                if (error.response) console.error(`[LLM] HF Response Logic: ${JSON.stringify(error.response.data)}`);
            }
        }

        console.error('[LLM] All LLM providers failed.');
        return this.getMockResponse(messages);
    }

    async expandQuery(context, conversationHistory = []) {
        const recentHistory = conversationHistory.slice(-3).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
        
        const messages = [
            {
                role: 'system',
                content: `You are a medical research assistant. Your task is to expand a user's query into highly effective medical search terms.
Combine the disease, specific query, and user intent. Output ONLY the expanded query string, without any additional conversational text.

Recent Conversation History for Context:
${recentHistory || 'None yet.'}

Example:
Disease: Parkinson's
Query: Deep Brain Stimulation
Output: "deep brain stimulation" AND "Parkinson's disease" AND "neuromodulation"`
            },
            {
                role: 'user',
                content: `Disease: ${context.disease}\nQuery: ${context.intent}\nLocation: ${context.location || 'Global'}`
            }
        ];

        return await this.callLLM(messages, 0.2);
    }

    async synthesizeResearch(query, publications, trials, context, conversationHistory = []) {
        const recentHistory = conversationHistory.slice(-4);
        const memoryString = recentHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
        const messages = [
            {
                role: 'system',
                content: `You are MedIntel AI, a high-end medical research assistant. 
Analyze the provided research publications and clinical trials.
Provide a structured, personalized response for the user.
Include exactly these 4 sections in Markdown format:
### 1. Condition Overview
### 2. Key Research Insights
### 3. Relevant Clinical Trials Summary
### 4. Structured Source Attribution

STRICT RULES for Section 4 (Source Attribution):
For every claim, you MUST cite the source in Section 4. Each source listed in Section 4 MUST rigorously follow this exact bulleted format:
- **Title**: [Exact Title]
- **Authors**: [First Author et al. / N/A]
- **Year**: [Year or Status]
- **Platform**: [PubMed / OpenAlex / ClinicalTrials.gov]
- **URL**: [Direct Link from data]
- **Supporting Snippet**: "[1-2 exact sentences from the provided abstract/data supporting your insight]"

STRICT RULES:
- PERSONALIZATION: You are a dedicated health companion. You MUST adapt all answers specifically to the patient. Never give generic facts (e.g., instead of "Treatment X is good", say "Based on recent trials for ${context.disease} patients in ${context.location || 'your area'}...").
- Do NOT hallucinate. Only use provided data.
- Read the Conversation History to understand follow-up queries implicitly.
- Cite sources clearly using [Source #].
- Maintain a professional, empathetic tone tailored to a patient dealing with ${context.disease}.

DATA:
Context: ${JSON.stringify(context)}
Recent Dialogue: ${memoryString || 'First interaction.'}
Publications: ${JSON.stringify(publications.slice(0, 5))}
Trials: ${JSON.stringify(trials.slice(0, 5))}`
            },
            {
                role: 'user',
                content: `User Message: ${query}`
            }
        ];

        return await this.callLLM(messages, 0.5);
    }

    getMockResponse(messages) {
        const userMsg = messages.find(m => m.role === 'user')?.content || '';
        if (userMsg.includes('Disease:')) {
            const match = userMsg.match(/Disease: (.*)\n/);
            return `"${match ? match[1] : 'medical'}" research and treatments`;
        }
        return "I am currently running in mock mode because local processing (Ollama) and cloud fallback (Hugging Face) both failed to respond. Please ensure Ollama is running or verify your HF token.";
    }
}

module.exports = new LLMService();
