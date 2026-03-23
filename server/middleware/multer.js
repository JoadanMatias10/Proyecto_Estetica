const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_FORMATS = ["jpg", "png", "jpeg", "webp"];

function createCloudinaryUpload(folder) {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder,
      allowed_formats: ALLOWED_IMAGE_FORMATS,
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_IMAGE_BYTES },
  });
}

const productUpload = createCloudinaryUpload("productos");
const serviceUpload = createCloudinaryUpload("servicios");

module.exports = {
  MAX_IMAGE_BYTES,
  createCloudinaryUpload,
  productUpload,
  serviceUpload,
};
