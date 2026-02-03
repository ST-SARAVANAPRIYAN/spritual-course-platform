/**
 * InnerSpark Server
 * Version: 1.0
 */

require('dotenv').config({ path: './backend/.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Files
app.use('/uploads', express.static(path.join(__dirname, 'backend/uploads')));
app.use(express.static(path.join(__dirname, 'frontend/html')));
app.use(express.static(path.join(__dirname, 'frontend')));

// Validate environment variables
if (!process.env.MONGODB_URL) {
    console.error('❌ ERROR: MONGODB_URL not found in environment variables');
    console.error('Please create a .env file in the root directory with MONGODB_URL');
    process.exit(1);
}

// MongoDB Connection
const MONGODB_URL = process.env.MONGODB_URL;

mongoose.connect(MONGODB_URL)
    .then(() => console.log('✅ InnerSpark Connected to MongoDB Cluster'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    });

// Routes
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/staff', require('./backend/routes/staff'));
app.use('/api/admin', require('./backend/routes/admin'));
app.use('/api/courses', require('./backend/routes/courses'));
app.use('/api/payments', require('./backend/routes/payments'));
app.use('/api/exams', require('./backend/routes/exams'));
app.use('/api/attendance', require('./backend/routes/attendance'));
app.use('/api/chatbot', require('./backend/routes/chatbot'));
app.use('/api/schedules', require('./backend/routes/schedules'));
app.use('/api/progress', require('./backend/routes/progress'));
app.use('/api/support', require('./backend/routes/support'));
app.use('/api/forum', require('./backend/routes/forum'));
app.use('/api/certificates', require('./backend/routes/certificates'));
app.use('/api/extra', require('./backend/routes/extra'));
app.use('/api/analytics', require('./backend/routes/analytics'));

// Basic Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/html/index.html'));
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 InnerSpark Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
