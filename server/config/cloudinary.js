const cloudinary = require("cloudinary").v2;

const cloudinaryName = process.env.CLOUDINARY_NAME;
const cloudinaryKey = process.env.CLOUDINARY_KEY;
const cloudinarySecret = process.env.CLOUDINARY_SECRET;
const isCloudinaryConfigured = Boolean(cloudinaryName && cloudinaryKey && cloudinarySecret);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudinaryName,
    api_key: cloudinaryKey,
    api_secret: cloudinarySecret,
  });
}

cloudinary.isConfigured = isCloudinaryConfigured;
cloudinary.getMissingConfig = () =>
  [
    ["CLOUDINARY_NAME", cloudinaryName],
    ["CLOUDINARY_KEY", cloudinaryKey],
    ["CLOUDINARY_SECRET", cloudinarySecret],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

module.exports = cloudinary;
