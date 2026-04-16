const mongoose = require("mongoose");
const { SERVICE_SEGMENTS, normalizeServiceSegment } = require("../utils/serviceSegments");

const serviceCategorySchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    segmento: { type: String, enum: SERVICE_SEGMENTS, required: true, set: normalizeServiceSegment },
    estado: { type: String, enum: ["Activa", "Inactiva"], default: "Activa" },
    descripcion: { type: String, default: "", trim: true },
  },
  { timestamps: true, collection: "categorias_servicio" }
);

serviceCategorySchema.index({ segmento: 1, nombre: 1 }, { unique: true });

module.exports = mongoose.model("ServiceCategory", serviceCategorySchema);
