const cloudinary = require('./config/cloudinary');
const path = require('path');

(async () => {
  try {
    const filePath = path.join(__dirname, '../public/images/logo.png');

    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'korim'
    });

    console.log("UPLOAD SUCCESS!");
    console.log("Image URL:", result.secure_url);
  } catch (err) {
    console.error("Upload failed:", err);
  }
})();
