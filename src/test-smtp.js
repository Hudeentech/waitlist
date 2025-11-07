require('dotenv').config();
const nodemailer = require('nodemailer');

(async () => {
  try {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465; // try 465 by default
    const secure = port === 465;

    console.log('Testing SMTP connection to', host, 'port', port, 'secure=', secure);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    try {
      await transporter.verify();
      console.log('SMTP verify: OK');
    } catch (verifyErr) {
      console.error('SMTP verify failed:', verifyErr && verifyErr.message);
    }

    // Attempt to send a simple test message to yourself (from->to same)
    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'SMTP direct test',
        text: 'This is a direct SMTP test message.'
      });
      console.log('Send result:', info.messageId);
      console.log('If this used Ethereal, preview:', nodemailer.getTestMessageUrl(info));
    } catch (sendErr) {
      console.error('Send failed:', sendErr && sendErr.message);
      if (sendErr && sendErr.stack) console.error(sendErr.stack);
    }
  } catch (err) {
    console.error('Unexpected error in SMTP test:', err);
  }
})();
