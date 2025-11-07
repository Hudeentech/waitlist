const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    isNotified: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Subscriber', subscriberSchema);