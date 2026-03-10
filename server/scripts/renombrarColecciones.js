require("dotenv").config();
const mongoose = require("mongoose");

const COLLECTION_RENAMES = [
  { from: "appointments", to: "citas" },
  { from: "carouselslides", to: "diapositivas_carrusel" },
  { from: "companyinfos", to: "informacion_empresa" },
  { from: "inventorymovements", to: "movimientos_inventario" },
  { from: "productbrands", to: "marcas_producto" },
  { from: "productcategories", to: "categorias_producto" },
  { from: "products", to: "productos" },
  { from: "promotions", to: "promociones" },
  { from: "sales", to: "ventas" },
  { from: "servicecategories", to: "categorias_servicio" },
  { from: "services", to: "servicios" },
  { from: "staffmembers", to: "miembros_personal" },
  { from: "users", to: "usuarios" },
];

async function renombrarColecciones() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "Estetica_Panamericana";

  if (!mongoUri) {
    throw new Error("Falta configurar MONGODB_URI en el archivo .env");
  }

  await mongoose.connect(mongoUri, { dbName });
  const db = mongoose.connection.db;

  const existentes = await db.listCollections({}, { nameOnly: true }).toArray();
  const nombres = new Set(existentes.map((collection) => collection.name));

  for (const { from, to } of COLLECTION_RENAMES) {
    if (!nombres.has(from)) {
      console.log(`[skip] No existe la coleccion: ${from}`);
      continue;
    }
    if (nombres.has(to)) {
      console.log(`[skip] El destino ya existe: ${to}`);
      continue;
    }

    await db.renameCollection(from, to);
    nombres.delete(from);
    nombres.add(to);
    console.log(`[ok] ${from} -> ${to}`);
  }
}

renombrarColecciones()
  .then(() => {
    console.log("Renombrado de colecciones completado.");
    return mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error("Error renombrando colecciones:", error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
