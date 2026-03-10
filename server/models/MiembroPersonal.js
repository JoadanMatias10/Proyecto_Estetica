const mongoose = require("mongoose");

const staffMemberSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    rol: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    telefono: { type: String, required: true, trim: true },
    estado: { type: String, enum: ["Activo", "Inactivo"], default: "Activo" },
  },
  { timestamps: true, collection: "miembros_personal" }
);

staffMemberSchema.index({ email: 1 }, { unique: true });
staffMemberSchema.index({ telefono: 1 }, { unique: true });

module.exports = mongoose.model("StaffMember", staffMemberSchema);
