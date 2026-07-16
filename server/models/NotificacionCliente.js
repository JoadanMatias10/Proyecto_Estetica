const mongoose = require("mongoose");

const clientNotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", default: null, index: true },
    tipo: { type: String, default: "recordatorio_cita", trim: true, index: true },
    canal: { type: String, enum: ["Email", "WhatsApp", "Notificacion interna"], default: "Email" },
    anticipacion: { type: String, default: "24 horas antes", trim: true },
    mensaje: { type: String, required: true, trim: true, maxlength: 500 },
    estado: {
      type: String,
      enum: ["preparada", "enviada", "lista_whatsapp", "fallida", "cancelada"],
      default: "preparada",
      index: true,
    },
    destinatario: { type: String, default: "", trim: true },
    whatsappUrl: { type: String, default: "", trim: true },
    enviadoAt: { type: Date, default: null },
    errorEnvio: { type: String, default: "", trim: true },
    origen: { type: String, enum: ["manual", "automatico"], default: "manual", index: true },
    fechaObjetivo: { type: Date, default: null },
  },
  { timestamps: true, collection: "notificaciones_cliente" }
);

clientNotificationSchema.index({ userId: 1, createdAt: -1 });
clientNotificationSchema.index({ appointmentId: 1, canal: 1, anticipacion: 1, origen: 1 });

module.exports = mongoose.model("ClientNotification", clientNotificationSchema);
