const mongoose = require("mongoose");

const carouselSlideSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    bgColor: { type: String, required: true, trim: true },
    estado: { type: String, enum: ["Activa", "Inactiva"], default: "Activa" },
    orden: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: "diapositivas_carrusel" }
);

carouselSlideSchema.index({ orden: 1 });

module.exports = mongoose.model("CarouselSlide", carouselSlideSchema);
