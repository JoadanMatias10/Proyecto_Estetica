const mongoose = require("mongoose");

const saleItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    producto: { type: String, required: true, trim: true },
    cantidad: { type: Number, required: true, min: 1 },
    precioUnitario: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    cliente: { type: String, default: "", trim: true },
    usuario: { type: String, required: true, trim: true },
    metodoPago: { type: String, required: true, enum: ["Efectivo", "Tarjeta", "Transferencia"], default: "Efectivo" },
    pagoCon: { type: Number, min: 0, default: 0 },
    cambio: { type: Number, min: 0, default: 0 },
    items: { type: [saleItemSchema], default: [], validate: [(value) => Array.isArray(value) && value.length > 0, "La venta debe tener al menos un item."] },
    subtotal: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    estado: { type: String, enum: ["Activa", "Anulada"], default: "Activa" },
    anuladaAt: { type: Date, default: null },
    anuladaPor: { type: String, default: "", trim: true },
    motivoAnulacion: { type: String, default: "", trim: true },
  },
  { timestamps: true, collection: "ventas" }
);

saleSchema.index({ createdAt: -1 });
saleSchema.index({ estado: 1, createdAt: -1 });
saleSchema.index({ usuario: 1, createdAt: -1 });

module.exports = mongoose.model("Sale", saleSchema);
