const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5005;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Database Connection
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('MongoDB Connected'))
        .catch(err => {
            console.error('MongoDB Connection Error:', err.message);
            console.warn('Proceeding without database (memory-only mode).');
        });
} else {
    console.warn('MONGODB_URI not set. Running without database.');
}

app.get('/', (req, res) => {
    res.send('MedIntel AI API is running...');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
