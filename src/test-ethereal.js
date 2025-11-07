require('dotenv').config();
const nodemailer = require('nodemailer');

(async () => {
  try {
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const to = process.env.TEST_TO || process.env.EMAIL_USER || 'recipient@example.com';

    const info = await transporter.sendMail({
      from: `"Waitlist Test" <${testAccount.user}>`,
      to,
      subject: 'Ethereal test message ✔',
      text: 'This is a test message sent through Ethereal',
      html: '<b>This is a test message sent through Ethereal</b>',
    });

    console.log('Ethereal test message sent, messageId:', info.messageId);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
  } catch (err) {
    console.error('Ethereal test failed:', err);
    process.exit(1);
  }
})();
