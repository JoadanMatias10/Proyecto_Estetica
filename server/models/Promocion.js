const mongoose = require("mongoose");

const promotionSchema = new mongoose.Schema(
  {
    titulo: { type: String, required: true, trim: true },
    descripcion: { type: String, default: "", trim: true },
    descuento: { type: String, required: true, trim: true },
    estado: { type: String, enum: ["Activa", "Inactiva"], default: "Activa" },
    destacadoInicio: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "promociones" }
);

promotionSchema.index({ estado: 1, createdAt: -1 });
promotionSchema.index({ destacadoInicio: 1, estado: 1, createdAt: -1 });

module.exports = mongoose.model("Promotion", promotionSchema);
