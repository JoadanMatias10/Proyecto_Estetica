const mongoose = require("mongoose");

const companyInfoSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    nombre: { type: String, default: "Estetica Panamericana", trim: true },
    direccion: { type: String, default: "", trim: true },
    telefono: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    mision: { type: String, default: "", trim: true },
    vision: { type: String, default: "", trim: true },
    valores: { type: String, default: "", trim: true },
    facebook: { type: String, default: "", trim: true },
    instagram: { type: String, default: "", trim: true },
    quienesSomosTexto: { type: String, default: "", trim: true },
    quienesSomosEsencia: { type: String, default: "", trim: true },
    horarioLunesSabado: { type: String, default: "", trim: true },
    horarioDomingo: { type: String, default: "", trim: true },
    mapLat: { type: String, default: "", trim: true },
    mapLng: { type: String, default: "", trim: true },
    mapZoom: { type: String, default: "15", trim: true },
    mapGoogleUrl: { type: String, default: "", trim: true },
    politicasDocumento: { type: String, default: "", trim: true },
    politicasDocumentoNombre: { type: String, default: "", trim: true },
    politicasDocumentoTipo: { type: String, default: "", trim: true },
  },
  { timestamps: true, collection: "informacion_empresa" }
);

module.exports = mongoose.model("CompanyInfo", companyInfoSchema);
