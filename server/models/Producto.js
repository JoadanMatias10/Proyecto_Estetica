const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    marca: { type: String, required: true, trim: true },
    precio: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    cantidadMedida: { type: Number, required: true, min: 1, default: 250 },
    unidadMedida: { type: String, required: true, trim: true, enum: ["ml", "g"], default: "ml" },
    categoria: { type: String, required: true, trim: true },
    descripcion: { type: String, default: "", trim: true },
    imagen: { type: String, default: "" },
    imagenNombre: { type: String, default: "", trim: true },
    rating: { type: Number, default: 4.8, min: 0, max: 5 },
  },
  { timestamps: true, collection: "productos" }
);

productSchema.index({ nombre: 1 });
productSchema.index({ categoria: 1 });

module.exports = mongoose.model("Product", productSchema);
