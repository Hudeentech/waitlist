const express = require('express');
const Subscriber = require('../models/Subscriber');
const { sendWelcomeEmail, sendLaunchNotification } = require('../services/emailService');

const router = express.Router();

// Simple admin auth using credentials from env
function ensureAdmin(req, res, next) {
  console.log('Checking admin session:', { 
    hasSession: !!req.session,
    sessionData: req.session
  });
  
  if (req.session && req.session.isAdmin === true) {
    console.log('Admin session verified');
    return next();
  }
  
  console.log('No admin session, redirecting to login');
  return res.redirect('/admin/login');
}

router.get('/login', (req, res) => {
  res.render('login', { error: req.flash('error') });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'password123';

    console.log('Login attempt:', { username, adminUser }); // Debug login attempt

    if (username === adminUser && password === adminPass) {
      // Set session data
      req.session.isAdmin = true;
      req.session.adminUser = username;
      
      // Wait for session to be saved
      await new Promise((resolve) => req.session.save(resolve));
      
      console.log('Session after login:', req.session); // Debug session data
      
      // Redirect with absolute path
      return res.redirect(302, '/admin/dashboard');
    }

    console.log('Login failed: invalid credentials'); // Debug failed login
    req.flash('error', 'Invalid credentials');
    return res.redirect('/admin/login');
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error', 'An error occurred during login');
    return res.redirect('/admin/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.get('/dashboard', ensureAdmin, async (req, res, next) => {
  try {
    console.log('Session data:', req.session); // Debug session
    const total = await Subscriber.countDocuments() || 0;
    const notified = await Subscriber.countDocuments({ isNotified: true }) || 0;
    
    // Ensure we have all required variables
    const renderData = {
      total,
      notified,
      user: req.session.adminUser || 'Admin',
      error: req.flash('error'),
      message: req.flash('message')
    };
    
    console.log('Render data:', renderData); // Debug render data
    
    res.render('dashboard', renderData);
  } catch (err) {
    console.error('Dashboard error:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    
    // Send a more helpful error response
    res.status(500).render('error', {
      error: process.env.NODE_ENV === 'production' 
        ? 'An error occurred while loading the dashboard'
        : err.message,
      user: req.session.adminUser || 'Admin'
    });
  }
});

router.get('/emails', ensureAdmin, async (req, res) => {
  const emails = await Subscriber.find().sort({ joinedAt: -1 }).lean();
  res.render('emails', { emails, user: req.session.adminUser });
});

router.get('/send', ensureAdmin, (req, res) => {
  res.render('send', { user: req.session.adminUser, message: req.flash('message'), error: req.flash('error') });
});

router.post('/send', ensureAdmin, async (req, res) => {
  const { subject, body, target } = req.body;

  try {
    let targets = [];
    if (target === 'all') {
      const subs = await Subscriber.find({}).lean();
      targets = subs.map(s => s.email);
    } else if (target === 'unnotified') {
      const subs = await Subscriber.find({ isNotified: false }).lean();
      targets = subs.map(s => s.email);
    } else if (target === 'custom' && req.body.customEmails) {
      targets = req.body.customEmails.split(',').map(e => e.trim()).filter(Boolean);
    }

    if (targets.length === 0) {
      req.flash('error', 'No recipients selected');
      return res.redirect('/admin/send');
    }

    // Use bulk send from emailService
    const { sendMailBulk } = require('../services/emailService');
    const result = await sendMailBulk(
      targets,
      subject || 'Message from Admin',
      body || '',
      5, // Send in batches of 5
      1000 // 1 second delay between batches
    );

    if (target === 'unnotified' && result.success > 0) {
      // Mark successful recipients as notified
      await Subscriber.updateMany(
        { email: { $in: result.results.filter(r => r.success).map(r => r.email) } },
        { $set: { isNotified: true } }
      );
    }

    const message = `Successfully sent to ${result.success}/${result.total} recipients`;
    req.flash('message', message);
    res.redirect('/admin/send');
  } catch (err) {
    console.error('Admin send error:', err);
    req.flash('error', 'Failed to send messages: ' + (err.message || 'Unknown error'));
    res.redirect('/admin/send');
  }
});

async function sendMailFromAdmin(to, subject, body) {
  // reuse sendLaunchNotification or sendWelcomeEmail style but with custom content
  try {
    // build simple mail options
    const from = process.env.EMAIL_USER || 'no-reply@example.com';
    const mailOptions = {
      from,
      to,
      subject: subject || 'Message from Admin',
      html: body || ''
    };

    // use internal transporter function via services if available
    // We'll call transporter directly by creating a simple transporter here
    const { transporterReady } = require('../services/emailService')._internal;
    await transporterReady;
    const transporter = require('nodemailer').createTransport({});
    // fallback to using existing sendLaunchNotification for now
    return await require('../services/emailService').sendLaunchNotification(to) || true;
  } catch (err) {
    console.error('sendMailFromAdmin error:', err);
    return false;
  }
}

module.exports = router;
