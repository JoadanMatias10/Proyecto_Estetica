const mongoose = require("mongoose");

const alexaAccessCodeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    identifier: { type: String, required: true, trim: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0, min: 0 },
    usedAt: { type: Date, default: null },
    sessionTokenHash: { type: String, default: "", index: true },
    sessionExpiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: "codigos_alexa" }
);

alexaAccessCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
alexaAccessCodeSchema.index({ userId: 1, usedAt: 1, createdAt: -1 });

module.exports = mongoose.model("AlexaAccessCode", alexaAccessCodeSchema);
