const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const Sale = require("../models/Venta");

const SOURCE_TAG = "Semilla ML regresion demanda v1";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || "Estetica_Panamericana",
  });

  const filter = { usuario: SOURCE_TAG };
  const [total, summary, monthly, missingProducts, sales] = await Promise.all([
    Sale.countDocuments(filter),
    Sale.aggregate([
      { $match: filter },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          firstDate: { $min: "$createdAt" },
          lastDate: { $max: "$createdAt" },
          itemLines: { $sum: 1 },
          units: { $sum: "$items.cantidad" },
          revenue: { $sum: "$items.subtotal" },
          products: { $addToSet: "$items.productId" },
          paymentMethods: { $addToSet: "$metodoPago" },
        },
      },
      {
        $project: {
          _id: 0,
          firstDate: 1,
          lastDate: 1,
          itemLines: 1,
          units: 1,
          revenue: { $round: ["$revenue", 2] },
          distinctProducts: { $size: "$products" },
          paymentMethods: 1,
        },
      },
    ]),
    Sale.aggregate([
      { $match: filter },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            year: { $year: { date: "$createdAt", timezone: "America/Mexico_City" } },
            month: { $month: { date: "$createdAt", timezone: "America/Mexico_City" } },
          },
          sales: { $addToSet: "$_id" },
          units: { $sum: "$items.cantidad" },
          revenue: { $sum: "$items.subtotal" },
        },
      },
      {
        $project: {
          _id: 0,
          period: {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              { $cond: [{ $lt: ["$_id.month", 10] }, "0", ""] },
              { $toString: "$_id.month" },
            ],
          },
          sales: { $size: "$sales" },
          units: 1,
          revenue: { $round: ["$revenue", 2] },
        },
      },
      { $sort: { period: 1 } },
    ]),
    Sale.aggregate([
      { $match: filter },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "productos",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $match: { product: { $size: 0 } } },
      { $count: "total" },
    ]),
    Sale.find(filter).select("subtotal total items estado").lean(),
  ]);

  const invalidTotals = sales.filter((sale) => {
    const itemSubtotal = (sale.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    return sale.estado !== "Activa"
      || Math.abs(itemSubtotal - Number(sale.subtotal || 0)) > 0.01
      || Math.abs(Number(sale.subtotal || 0) - Number(sale.total || 0)) > 0.01;
  }).length;

  console.log(JSON.stringify({
    totalSyntheticSales: total,
    validTarget: total === 1000,
    invalidTotals,
    missingProductReferences: Number(missingProducts[0]?.total || 0),
    summary: summary[0] || null,
    monthly,
  }, null, 2));

  if (total !== 1000 || invalidTotals > 0 || Number(missingProducts[0]?.total || 0) > 0) {
    throw new Error("La verificacion de las ventas sinteticas no fue satisfactoria.");
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error.message);
  try {
    await mongoose.disconnect();
  } catch (_error) {
    // La conexion ya estaba cerrada.
  }
  process.exit(1);
});
