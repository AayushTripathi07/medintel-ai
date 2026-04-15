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
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => {
        console.error('MongoDB Connection Error:', err.message);
        console.warn('Proceeding with in-memory/mock behavior if database is unavailable.');
    });

// Basic check
app.get('/', (req, res) => {
    res.send('MedIntel AI API is running...');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
