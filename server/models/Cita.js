const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    servicio: { type: String, required: true },
    fechaHora: { type: Date, required: true },
    notas: { type: String, default: "" },
    estado: { type: String, default: "programada" },
  },
  { timestamps: true, collection: "citas" }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
