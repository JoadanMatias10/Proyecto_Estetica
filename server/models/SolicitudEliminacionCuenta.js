const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  status: { type: String, enum: ["verification", "pending"], default: "verification" },
  codeHash: { type: String, default: "" },
  attempts: { type: Number, default: 0 },
  nextCodeAt: { type: Date, default: () => new Date(0) },
  expiresAt: { type: Date },
  nextAttemptAt: { type: Date, default: () => new Date(0) },
  leaseUntil: { type: Date, default: () => new Date(0) },
  cleanupAttempts: { type: Number, default: 0 },
  firebaseUid: { type: String, default: "" },
  proofPublicIds: { type: [String], default: [] },
  paymentIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
}, { timestamps: true, collection: "solicitudes_eliminacion_cuenta" });

// Only unconfirmed requests expire. Confirmed work survives restarts and outages.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });

module.exports = mongoose.model("AccountDeletionRequest", schema);
