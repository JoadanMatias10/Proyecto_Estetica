const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "productos",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_BYTES },
});

module.exports = upload;
