const mongoose = require("mongoose");
require("dotenv").config();
const Sale = require("./models/Venta");

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: "Estetica_Panamericana" });
    const stats = await Sale.aggregate([
      { $unwind: "$items" },
      { 
        $match: { 
          "items.producto": { $regex: /SHAMPOO DI ARGAN/i },
          estado: "Activa" 
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          totalUnits: { $sum: "$items.cantidad" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    console.log("\n--- VENTAS: SHAMPOO DI ARGAN ---");
    const months = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    stats.filter(s => s._id.year === 2026).forEach(s => {
      console.log(`${months[s._id.month]} 2026: ${s.totalUnits} unidades`);
    });
    console.log("-------------------------------\n");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
