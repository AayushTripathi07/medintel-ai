const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Database Connection
if (process.env.MONGODB_URI && process.env.MONGODB_URI !== 'your_mongodb_uri_here') {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('MongoDB Connected'))
        .catch(err => {
            console.error('MongoDB Connection Error:', err.message);
            console.warn('Proceeding with in-memory/mock behavior.');
        });
} else {
    console.warn('MONGODB_URI not found. Running in ephemeral in-memory mode (perfect for cloud demos).');
}

// Basic check
app.get('/', (req, res) => {
    res.send('MedIntel AI API is running...');
});

// Local development execution
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running locally on port ${PORT}`);
    });
}

// Express requires exporting the app object for Vercel Serverless 
module.exports = app;
