const mongoose = require("mongoose");

const clientNotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", default: null, index: true },
    canal: { type: String, enum: ["Email", "WhatsApp", "Notificacion interna"], default: "Email" },
    anticipacion: { type: String, default: "24 horas antes", trim: true },
    mensaje: { type: String, required: true, trim: true, maxlength: 500 },
    estado: { type: String, enum: ["preparada", "cancelada"], default: "preparada", index: true },
    fechaObjetivo: { type: Date, default: null },
  },
  { timestamps: true, collection: "notificaciones_cliente" }
);

clientNotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ClientNotification", clientNotificationSchema);
