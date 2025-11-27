const nodemailer = require("nodemailer");
require("dotenv").config();

let transporter = null;
// transporterReady is a promise that resolves once the transporter is initialized
const transporterReady = (async () => {
  try {
    if (
      process.env.SMTP_HOST &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASS
    ) {
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        // use SSL (secure) for port 465, otherwise use STARTTLS (secure: false)
        secure: smtpPort === 465,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        // timeouts to fail faster if the network is blocked
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        pool: false,
      });

      try {
        await transporter.verify();
        console.log("SMTP transporter verified");
      } catch (verifyErr) {
        console.warn(
          "SMTP transporter verification failed:",
          verifyErr && verifyErr.message
        );
      }
    } else {
      // Fallback to Ethereal for development/testing if SMTP isn't configured
      console.log(
        "SMTP not configured — creating Ethereal test account for development"
      );
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(
        "Ethereal account created - preview messages at the returned URLs"
      );
    }
  } catch (err) {
    console.error("Error initializing mail transporter:", err);
  }
  return transporter;
})();

// Helper: sleep for ms
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Send with retries and exponential backoff
async function sendMailWithRetry(mailOptions, maxAttempts = 3) {
  await transporterReady; // ensure transporter initialized
  if (!transporter) {
    console.error("No mail transporter available");
    return { success: false };
  }

  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const info = await transporter.sendMail(mailOptions);

      // If using Ethereal, provide preview URL
      const preview = nodemailer.getTestMessageUrl(info) || null;
      if (preview) console.log("Preview URL:", preview);

      return { success: true, info, preview };
    } catch (err) {
      lastError = err;
      const code = err && err.code ? err.code : "";
      console.warn(`Mail send attempt ${attempt} failed:`, err && err.message);

      // transient network errors — allow retry
      const transient =
        [
          "ETIMEDOUT",
          "ESOCKET",
          "ECONNRESET",
          "EAI_AGAIN",
          "ENOTFOUND",
        ].includes(code) || /timeout|connect/i.test(err && err.message);

      if (!transient) {
        // Non-transient error — don't retry
        break;
      }

      // exponential backoff
      const backoff = Math.pow(2, attempt) * 500; // 1s, 2s, 4s... roughly
      await sleep(backoff);
    }
  }

  return { success: false, error: lastError };
}

// Send multiple emails in parallel with rate limiting
async function sendMailBulk(
  recipients,
  subject,
  html,
  batchSize = 5,
  delayMs = 1000
) {
  const from = process.env.EMAIL_USER || "no-reply@example.com";
  const results = [];

  // Process recipients in batches
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const promises = batch.map((to) => {
      const mailOptions = { from, to, subject, html };
      return sendMailWithRetry(mailOptions, 2).then((result) => ({
        email: to,
        ...result,
      }));
    });

    // Wait for current batch to complete
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    // Add delay between batches to avoid overwhelming the SMTP server
    if (i + batchSize < recipients.length) {
      await sleep(delayMs);
    }
  }

  return {
    success: results.filter((r) => r.success).length,
    total: results.length,
    results,
  };
}

const sendWelcomeEmail = async (email) => {
  const from = process.env.EMAIL_USER || "no-reply@example.com";
  const attachments = [];

  const mailOptions = {
    from,
    to: email,
    subject: "Welcome to Our Waitlist!",
    attachments,
    html: `
                        <!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome</title>
</head>
<body style="background:#f7f7f7; font-family:Arial, sans-serif; padding:0; margin:0;">
    <table align="center" cellspacing="0" cellpadding="0" width="100%" style="max-width:600px; margin:auto;">
        <tr>
            <td style="padding:40px 20px; text-align:center; background:white; border-bottom:3px solid #52AF44; border-radius:10px 10px 0 0;">
                         <img src="https://res.cloudinary.com/djk0xb5gg/image/upload/v1764240016/Full_Logo_hrbk8d.png"
                                alt="KORIM Logo"
                                width="100"
                                style="display:block;margin:auto;" />
                <h2 style="color:#52AF44; margin-top:20px;">You're Officially In 🎉</h2>
            </td>
        </tr>

        <tr>
            <td style="background:white; padding:25px; font-size:15px; color:#333;">
                <p>We're excited to share that KORIM is getting ready to launch in Nigeria! 🎉</p>
                
                <p style="margin-top:18px;">As one of our early waitlist members, you'll be among the first to experience Nigeria's most trusted local service platform.</p>
                
                <p style="margin-top:18px;"><b>What to look forward to:</b></p>
                <ul style="margin-top:10px;">
                    <li>Access to verified service providers near you</li>
                    <li>Easy appointment booking</li>
                    <li>Fast, reliable service</li>
                    <li>Secure payment system</li>
                </ul>
                
                <p style="margin-top:18px;">Thank you for being one of the first to believe in our vision. We'll notify you as soon as we launch!</p>
            </td>
        </tr>

        <tr>
            <td style="background:white; padding:15px; text-align:center;">
                <div style="display:inline-block; padding:12px 24px; background:#52AF44; color:white; text-decoration:none; border-radius:8px; font-weight:600;">
                    Stay Tuned for Launch!
                </div>
            </td>
        </tr>

        <tr>
            <td style="background:white; padding:10px 0 25px 0; text-align:center;">
                <p style="font-size:14px; color:#333; font-weight:600; margin-bottom:10px;">Follow KORIM</p>

                <a style="margin:0 10px; color:#52AF44; font-size:14px; text-decoration:none;" href="#">Facebook</a>
                <a style="margin:0 10px; color:#52AF44; font-size:14px; text-decoration:none;" href="#">X (formerly twitter)</a>
            </td>
        </tr>

        <tr>
            <td style="text-align:center; padding:15px; font-size:12px; color:#777;">
                © 2025 KORIM. All Rights Reserved.
            </td>
        </tr>
    </table>
</body>
</html>

                `,
  };

  const result = await sendMailWithRetry(
    mailOptions,
    Number(process.env.EMAIL_MAX_RETRIES) || 3
  );
  if (!result.success) {
    console.error(
      "Error sending welcome email:",
      result.error || "unknown error"
    );
    return false;
  }
  return true;
};

const sendLaunchNotification = async (email) => {
  const from = process.env.EMAIL_USER || "no-reply@example.com";
  const mailOptions = {
    from,
    to: email,
    subject: "KORIM Launch Update 🚀",
    attachments,
    html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <title>KORIM Launch Update</title>
            </head>
            <body style="background:#f7f7f7; font-family:Arial, sans-serif; padding:0; margin:0;">
                <table align="center" cellspacing="0" cellpadding="0" width="100%" style="max-width:600px; margin:auto;">
                    <tr>
                        <td style="padding:40px 20px; text-align:center; background:white; border-bottom:3px solid #52AF44; border-radius:10px 10px 0 0;">
                            <img src="https://res.cloudinary.com/djk0xb5gg/image/upload/v1764240016/Full_Logo_hrbk8d.png"
                                alt="KORIM Logo"
                                width="100"
                                style="display:block;margin:auto;" />
                            <h2 style="color:#52AF44; margin:0;">Coming Soon!</h2>
                        </td>
                    </tr>
                    <tr>
                        <td style="background:white; padding:25px; font-size:15px; color:#333;">
                            <p>We're excited to share that KORIM is getting ready to launch in Nigeria! 🎉</p>
                            
                            <p style="margin-top:18px;">As one of our early waitlist members, you'll be among the first to experience Nigeria's most trusted local service platform.</p>
                            
                            <p style="margin-top:18px;">What to look forward to:</p>
                            <ul style="margin-top:10px;">
                                <li>Access to verified service providers near you</li>
                                <li>Easy appointment booking</li>
                                <li>Fast, reliable service</li>
                                <li>Secure payment system</li>
                            </ul>
                            
                            <p style="margin-top:18px;">Thank you for being one of the first to believe in our vision. We'll notify you as soon as we launch!</p>
                        </td>
                    </tr>

                    <tr>
                        <td style="background:white; padding:15px; text-align:center;">
                            <div style="display:inline-block; padding:12px 24px; background:#52AF44; color:white; text-decoration:none; border-radius:8px; font-weight:600;">
                                Stay Tuned for Launch!
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td style="background:white; padding:25px; text-align:center;">
                            <p style="font-size:14px; color:#333; font-weight:600; margin-bottom:10px;">Follow KORIM</p>
                            <div>
                                <a href="#" style="color:#52AF44; text-decoration:none; margin:0 10px;">Facebook</a>
                                <a href="#" style="color:#52AF44; text-decoration:none; margin:0 10px;">X (formerly twitter)</a>
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td style="text-align:center; padding:15px; font-size:12px; color:#777;">
                            © 2025 KORIM. All Rights Reserved.
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `,
  };

  const result = await sendMailWithRetry(
    mailOptions,
    Number(process.env.EMAIL_MAX_RETRIES) || 3
  );
  if (!result.success) {
    console.error(
      "Error sending launch notification:",
      result.error || "unknown error"
    );
    return false;
  }
  return true;
};

module.exports = {
  sendWelcomeEmail,
  sendLaunchNotification,
  sendMailBulk,
  // exported for testing/debugging
  _internal: {
    transporterReady,
    sendMailWithRetry,
  },
};
