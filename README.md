# Waitlist Email Backend

This is a Node.js backend service that handles email functionality for a waitlist system. It allows users to subscribe to a waitlist and sends them email notifications.

## Features

- User subscription to waitlist
- Automated welcome emails
- Launch notification system
- MongoDB integration for storing subscriber data
- TypeScript support

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a .env file with the following variables:
```
MONGODB_URI=mongodb://localhost:27017/waitlist
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

3. Build the project:
```bash
npm run build
```

4. Start the server:
```bash
npm start
```

For development:
```bash
npm run dev
```

## API Endpoints

### 1. Subscribe to Waitlist
- **POST** `/api/waitlist/subscribe`
- **Body**: `{ "email": "user@example.com" }`
- **Response**: 
  ```json
  {
    "message": "Successfully joined the waitlist",
    "subscriberId": "..."
  }
  ```

### 2. Send Launch Notifications
- **POST** `/api/waitlist/notify-launch`
- **Response**:
  ```json
  {
    "message": "Launch notifications sent",
    "notifications": [
      {
        "email": "user@example.com",
        "status": "success"
      }
    ]
  }
  ```

## Email Templates

1. **Welcome Email**: Sent immediately after subscription
2. **Launch Notification**: Sent when the platform launches

## Notes

- Make sure to replace the email configuration in `.env` with your actual email service credentials
- For Gmail, you'll need to use an App Password if 2FA is enabled
- The MongoDB connection string can be modified to connect to your database