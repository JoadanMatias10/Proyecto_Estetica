const mongoose = require("mongoose");

const inventoryMovementSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: false },
    producto: { type: String, required: true, trim: true },
    marca: { type: String, default: "", trim: true },
    categoria: { type: String, default: "", trim: true },
    cantidadMedida: { type: Number, min: 1 },
    unidadMedida: { type: String, trim: true, enum: ["", "ml", "g"], default: "" },
    accion: { type: String, enum: ["Entrada", "Salida"], required: true },
    cantidad: { type: Number, required: true, min: 1 },
    usuario: { type: String, required: true, trim: true },
    stockAnterior: { type: Number, required: true, min: 0 },
    stockActual: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: "movimientos_inventario" }
);

inventoryMovementSchema.index({ productId: 1, createdAt: -1 });
inventoryMovementSchema.index({ producto: 1, createdAt: -1 });
inventoryMovementSchema.index({ accion: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryMovement", inventoryMovementSchema);
