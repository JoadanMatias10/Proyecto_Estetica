require("dotenv").config();
const mongoose = require("mongoose");
const Appointment = require("../models/Cita");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || "Estetica_Panamericana",
  });

  const filter = { estado: { $in: ["cancelada", "completada"] } };
  const seedFilter = { ...filter, notas: "Semilla ML clasificacion citas" };

  const [all, seed, byMonth, bySeedMonth] = await Promise.all([
    Appointment.countDocuments(filter),
    Appointment.countDocuments(seedFilter),
    Appointment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $month: "$fechaHora" },
          total: { $sum: 1 },
          canceladas: { $sum: { $cond: [{ $eq: ["$estado", "cancelada"] }, 1, 0] } },
          completadas: { $sum: { $cond: [{ $eq: ["$estado", "completada"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Appointment.aggregate([
      { $match: seedFilter },
      {
        $group: {
          _id: { $month: "$fechaHora" },
          total: { $sum: 1 },
          canceladas: { $sum: { $cond: [{ $eq: ["$estado", "cancelada"] }, 1, 0] } },
          completadas: { $sum: { $cond: [{ $eq: ["$estado", "completada"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  console.log(JSON.stringify({ all, seed, byMonth, bySeedMonth }, null, 2));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error.message);
  try {
    await mongoose.disconnect();
  } catch (_error) {
    // ignore
  }
  process.exit(1);
});
