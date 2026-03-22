const mongoose = require("mongoose");

function normalizeOptionalUsername(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, sparse: true, default: undefined, set: normalizeOptionalUsername },
    nombre: { type: String, required: true, trim: true },
    apellidoPaterno: { type: String, trim: true, default: "" },
    apellidoMaterno: { type: String, trim: true, default: "" },
    telefono: { type: String, required: true, unique: true },
    correo: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    role: { type: String, enum: ["client", "admin", "stylist"], default: "client", index: true },
    accountStatus: { type: String, enum: ["active", "pending", "inactive"], default: "active", index: true },
    passwordSetupRequired: { type: Boolean, default: false },
    inviteSentAt: { type: Date, default: null },
    passwordResetSentAt: { type: Date, default: null },
    activatedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "usuarios" }
);

module.exports = mongoose.model("User", userSchema);
