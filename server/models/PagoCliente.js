const mongoose = require("mongoose");

const clientPaymentItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, default: null },
    nombre: { type: String, required: true, trim: true },
    cantidad: { type: Number, required: true, min: 1 },
    precio: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const clientPaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tipo: { type: String, enum: ["Producto", "Servicio"], required: true, index: true },
    concepto: { type: String, required: true, trim: true },
    total: { type: Number, required: true, min: 0 },
    metodo: {
      type: String,
      enum: ["Tarjeta", "Transferencia", "Pago en sucursal"],
      required: true,
      default: "Transferencia",
    },
    estatus: {
      type: String,
      enum: ["Pendiente", "Procesando", "Pagado", "Confirmado", "Rechazado"],
      default: "Pendiente",
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
      index: true,
    },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      default: null,
      index: true,
    },
    detalle: {
      type: [clientPaymentItemSchema],
      default: [],
      validate: [(value) => Array.isArray(value) && value.length > 0, "El pago debe tener al menos un item."],
    },
    cliente: {
      nombre: { type: String, default: "", trim: true },
      telefono: { type: String, default: "", trim: true },
      correo: { type: String, default: "", trim: true, lowercase: true },
    },
    referencia: { type: String, default: "", trim: true },
    comprobanteUrl: { type: String, default: "", trim: true },
    comprobantePublicId: { type: String, default: "", trim: true },
    comprobanteNombre: { type: String, default: "", trim: true },
    notas: { type: String, default: "", trim: true, maxlength: 300 },
    notasAdmin: { type: String, default: "", trim: true, maxlength: 300 },
    revisadoAt: { type: Date, default: null },
    revisadoPor: { type: String, default: "", trim: true },
  },
  { timestamps: true, collection: "pagos_cliente" }
);

clientPaymentSchema.index({ userId: 1, createdAt: -1 });
clientPaymentSchema.index({ estatus: 1, createdAt: -1 });

module.exports = mongoose.model("ClientPayment", clientPaymentSchema);
