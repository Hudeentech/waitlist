const express = require('express');
const { sendWelcomeEmail, sendLaunchNotification } = require('../services/emailService');
const Subscriber = require('../models/Subscriber');

const router = express.Router();

// Subscribe to waitlist
router.post('/subscribe', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if email already exists
        const existingSubscriber = await Subscriber.findOne({ email });
        if (existingSubscriber) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new subscriber
        const subscriber = new Subscriber({ email });
        await subscriber.save();

        // Send welcome email
        const emailSent = await sendWelcomeEmail(email);

        if (!emailSent) {
            console.warn('Welcome email could not be sent');
        }

        res.status(201).json({
            message: 'Successfully joined the waitlist',
            subscriberId: subscriber._id
        });
    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Notify all subscribers about launch
router.post('/notify-launch', async (req, res) => {
    try {
        const subscribers = await Subscriber.find({ isNotified: false });
        const notifications = [];

        for (const subscriber of subscribers) {
            const notified = await sendLaunchNotification(subscriber.email);
            if (notified) {
                subscriber.isNotified = true;
                await subscriber.save();
                notifications.push({
                    email: subscriber.email,
                    status: 'success'
                });
            } else {
                notifications.push({
                    email: subscriber.email,
                    status: 'failed'
                });
            }
        }

        res.json({
            message: 'Launch notifications sent',
            notifications
        });
    } catch (error) {
        console.error('Launch notification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;