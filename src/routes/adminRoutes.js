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
    const adminUser = process.env.ADMIN_USER || 'Korimtec';
    const adminPass = process.env.ADMIN_PASS || 'password123';

    console.log('Login attempt:', { username, adminUser });

    if (username === adminUser && password === adminPass) {
      req.session.isAdmin = true;
      req.session.adminUser = username;
      await new Promise(resolve => req.session.save(resolve));

      console.log('Session after login:', req.session);
      return res.redirect(302, '/admin/dashboard');
    }

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

router.get('/dashboard', ensureAdmin, async (req, res) => {
  try {
    const total = await Subscriber.countDocuments() || 0;
    const notified = await Subscriber.countDocuments({ isNotified: true }) || 0;

    res.render('dashboard', {
      total,
      notified,
      user: req.session.adminUser || 'Admin',
      error: req.flash('error'),
      message: req.flash('message')
    });

  } catch (err) {
    console.error('Dashboard error:', err);

    res.status(500).render('error', {
      error: err.message,
      user: req.session.adminUser || 'Admin'
    });
  }
});

// Subscribers list page
router.get('/emails', ensureAdmin, async (req, res) => {
  const emails = await Subscriber.find().sort({ joinedAt: -1 }).lean();
  res.render('emails', { emails, user: req.session.adminUser });
});

// FIXED — THIS ROUTE WAS MISSING subscriber data
router.get('/send', ensureAdmin, async (req, res) => {
  try {
    const allSubs = await Subscriber.find().select("email -_id").lean();
    const emails = allSubs.map(s => s.email);

    res.render('send', { 
      user: req.session.adminUser,
      subscribers: emails,
      message: req.flash('message'),
      error: req.flash('error')
    });

  } catch (err) {
    console.error("GET /send error:", err);
    req.flash("error", "Failed to load subscribers.");
    res.redirect("/admin/dashboard");
  }
});

// Send email
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

    const { sendMailBulk } = require('../services/emailService');
    const result = await sendMailBulk(
      targets,
      subject || 'Message from Admin',
      body || '',
      5,
      1000
    );

    if (target === 'unnotified' && result.success > 0) {
      await Subscriber.updateMany(
        { email: { $in: result.results.filter(r => r.success).map(r => r.email) } },
        { $set: { isNotified: true } }
      );
    }

    req.flash('message', `Successfully sent to ${result.success}/${result.total} recipients`);
    res.redirect('/admin/send');

  } catch (err) {
    console.error('Admin send error:', err);
    req.flash('error', 'Failed to send messages: ' + (err.message || 'Unknown error'));
    res.redirect('/admin/send');
  }
});

module.exports = router;
