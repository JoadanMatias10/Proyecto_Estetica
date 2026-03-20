require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/Usuario");

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "Estetica_Panamericana";

  if (!mongoUri) {
    throw new Error("MONGODB_URI no configurado.");
  }

  await mongoose.connect(mongoUri, { dbName });

  const result = await User.updateMany(
    { username: null },
    { $unset: { username: 1 } }
  );

  console.log(
    `Usuarios normalizados: ${result.modifiedCount || 0} de ${result.matchedCount || 0}`
  );

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("Error normalizando usernames:", error.message);
    try {
      await mongoose.disconnect();
    } catch (_error) {
      // ignore
    }
    process.exit(1);
  });
