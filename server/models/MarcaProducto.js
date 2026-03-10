const mongoose = require("mongoose");

const productBrandSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    pais: { type: String, default: "", trim: true },
    estado: { type: String, enum: ["Activa", "Inactiva"], default: "Activa" },
    descripcion: { type: String, default: "", trim: true },
  },
  { timestamps: true, collection: "marcas_producto" }
);

productBrandSchema.index({ nombre: 1 }, { unique: true });

module.exports = mongoose.model("ProductBrand", productBrandSchema);
