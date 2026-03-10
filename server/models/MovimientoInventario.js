const mongoose = require("mongoose");

const inventoryMovementSchema = new mongoose.Schema(
  {
    producto: { type: String, required: true, trim: true },
    accion: { type: String, enum: ["Entrada", "Salida"], required: true },
    cantidad: { type: Number, required: true, min: 1 },
    usuario: { type: String, required: true, trim: true },
    stockAnterior: { type: Number, required: true, min: 0 },
    stockActual: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: "movimientos_inventario" }
);

inventoryMovementSchema.index({ producto: 1, createdAt: -1 });
inventoryMovementSchema.index({ accion: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryMovement", inventoryMovementSchema);
