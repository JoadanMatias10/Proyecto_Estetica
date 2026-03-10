const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    apellidoPaterno: { type: String, required: true, trim: true },
    apellidoMaterno: { type: String, required: true, trim: true },
    telefono: { type: String, required: true, unique: true },
    correo: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    role: { type: String, enum: ["client", "admin"], default: "client", index: true },
  },
  { timestamps: true, collection: "usuarios" }
);

module.exports = mongoose.model("User", userSchema);
