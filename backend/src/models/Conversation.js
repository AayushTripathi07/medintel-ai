const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const MessageSchema = new Schema({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    sources: [{
        title: String,
        authors: [String],
        year: String,
        platform: String,
        url: String,
        snippet: String,
        type: { type: String, enum: ['publication', 'trial'] }
    }],
    timestamp: { type: Date, default: Date.now }
});

const ConversationSchema = new Schema({
    messages: [MessageSchema],
    userContext: {
        patientName: String,
        disease: String,
        intent: String,
        location: String
    },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Conversation', ConversationSchema);
