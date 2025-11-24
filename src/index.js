const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const waitlistRoutes = require('./routes/waitlistRoutes');
const adminRoutes = require('./routes/adminRoutes');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');

const app = express();

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Security headers
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    });
    next();
});

// Production trust proxy
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Session configuration for Vercel
app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: true,       // IMPORTANT FOR LOCAL
        sameSite: "none",// Required for cross-site cookie handling
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(flash());

// view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Database connection with detailed error handling
async function startServer() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Startup error:', {
            message: err.message,
            code: err.code,
            name: err.name
        });
        process.exit(1);
    }
}

startServer();

// Routes
app.use('/api/waitlist', waitlistRoutes);
app.use('/admin', adminRoutes);

// Detailed error handling
app.use((err, req, res, next) => {
    console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
    });
    
    // Send detailed error in development
    res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong!' 
            : err.message || 'Unknown error'
    });
});

// Note: server is started inside startServer() after DB connection.