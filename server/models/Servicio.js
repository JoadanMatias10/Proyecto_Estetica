const mongoose = require("mongoose");

const serviceGalleryImageSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "", trim: true },
    nombre: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    segmento: { type: String, enum: ["Mujer", "Hombre", "Nino"], required: true },
    subcategoria: { type: String, required: true, trim: true },
    precio: { type: Number, required: true, min: 0 },
    tiempo: { type: String, required: true, trim: true },
    descripcion: { type: String, default: "", trim: true },
    imagen: { type: String, default: "" },
    imagenPublicId: { type: String, default: "", trim: true },
    imagenNombre: { type: String, default: "", trim: true },
    galeriaImagenes: {
      type: [serviceGalleryImageSchema],
      default: () => [],
    },
  },
  { timestamps: true, collection: "servicios" }
);

serviceSchema.index({ segmento: 1, subcategoria: 1 });
serviceSchema.index({ nombre: 1 });

module.exports = mongoose.model("Service", serviceSchema);
