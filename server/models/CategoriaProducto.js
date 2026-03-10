const mongoose = require("mongoose");

const productCategorySchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    estado: { type: String, enum: ["Activa", "Inactiva"], default: "Activa" },
    descripcion: { type: String, default: "", trim: true },
  },
  { timestamps: true, collection: "categorias_producto" }
);

productCategorySchema.index({ nombre: 1 }, { unique: true });

module.exports = mongoose.model("ProductCategory", productCategorySchema);
