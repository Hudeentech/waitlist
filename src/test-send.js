const { sendWelcomeEmail, _internal } = require('./services/emailService');

(async () => {
  // Wait for transporter to initialize
  await _internal.transporterReady;

  const ok = await sendWelcomeEmail('test@example.com');
  console.log('sendWelcomeEmail returned:', ok);
})();
