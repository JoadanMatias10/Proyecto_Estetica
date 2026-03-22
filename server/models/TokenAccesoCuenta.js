const mongoose = require("mongoose");

const accountAccessTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, enum: ["invite", "password_reset"], required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "tokens_acceso_cuenta" }
);

accountAccessTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
accountAccessTokenSchema.index({ userId: 1, type: 1, usedAt: 1 });

module.exports = mongoose.model("AccountAccessToken", accountAccessTokenSchema);
