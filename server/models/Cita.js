const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stylistId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", default: null, index: true },
    servicio: { type: String, required: true },
    servicioPrecio: { type: Number, default: 0, min: 0 },
    duracionMinutos: { type: Number, default: 30, min: 15 },
    fechaHora: { type: Date, required: true },
    notas: { type: String, default: "" },
    estado: { type: String, enum: ["pendiente", "programada", "confirmada", "completada", "cancelada"], default: "pendiente" },
  },
  { timestamps: true, collection: "citas" }
);

appointmentSchema.index({ stylistId: 1, fechaHora: 1 });
appointmentSchema.index({ fechaHora: 1, estado: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
