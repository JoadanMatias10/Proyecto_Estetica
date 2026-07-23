const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const ClientPayment = require("../models/PagoCliente");
const Service = require("../models/Servicio");

const SOURCE_TAG = "Semilla ML clustering recomendacion servicios v1";
const OLD_SOURCE_TAG = "Semilla ML recomendacion servicios v1";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || "Estetica_Panamericana",
  });
  const [interactions, services, oldSeedCount] = await Promise.all([
    ClientPayment.find({ tipo: "Servicio", notas: SOURCE_TAG }).sort({ createdAt: 1, _id: 1 }).lean(),
    Service.find().select("subcategoria").lean(),
    ClientPayment.countDocuments({ tipo: "Servicio", notas: OLD_SOURCE_TAG }),
  ]);
  const serviceById = new Map(services.map((service) => [String(service._id), service]));
  const clientRows = new Map();
  let invalidInteractions = 0;
  let invalidServiceReferences = 0;
  let totalItems = 0;
  let minItems = Number.POSITIVE_INFINITY;
  let maxItems = 0;

  interactions.forEach((interaction) => {
    const items = Array.isArray(interaction.detalle) ? interaction.detalle : [];
    const calculatedTotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const uniqueIds = new Set(items.map((item) => String(item.itemId || "")));
    if (!items.length || uniqueIds.size !== items.length || Math.abs(calculatedTotal - Number(interaction.total || 0)) > 0.01) {
      invalidInteractions += 1;
    }

    const userId = String(interaction.userId || "");
    const row = clientRows.get(userId) || {
      clienteId: userId,
      frecuencia: 0,
      gastoTotal: 0,
      serviciosConsumidos: 0,
      ultimaVisita: null,
      categorias: {},
    };
    row.frecuencia += 1;
    row.gastoTotal += Number(interaction.total || 0);
    row.serviciosConsumidos += items.length;
    if (!row.ultimaVisita || new Date(interaction.createdAt) > row.ultimaVisita) row.ultimaVisita = new Date(interaction.createdAt);
    items.forEach((item) => {
      const service = serviceById.get(String(item.itemId || ""));
      if (!service) {
        invalidServiceReferences += 1;
        return;
      }
      const category = String(service.subcategoria || "Sin categoria");
      row.categorias[category] = Number(row.categorias[category] || 0) + 1;
    });
    clientRows.set(userId, row);
    totalItems += items.length;
    minItems = Math.min(minItems, items.length);
    maxItems = Math.max(maxItems, items.length);
  });

  const lastDatasetDate = interactions.length ? new Date(interactions[interactions.length - 1].createdAt) : new Date();
  const dataset = Array.from(clientRows.values()).map((row) => {
    const totalCategoryItems = Object.values(row.categorias).reduce((sum, value) => sum + value, 0);
    const categoryShare = (category) => Number(((row.categorias[category] || 0) / Math.max(1, totalCategoryItems)).toFixed(4));
    return {
      clienteId: row.clienteId,
      frecuencia: row.frecuencia,
      gastoPromedio: Number((row.gastoTotal / row.frecuencia).toFixed(2)),
      serviciosPromedio: Number((row.serviciosConsumidos / row.frecuencia).toFixed(2)),
      diasDesdeUltimaVisita: Math.max(0, Math.floor((lastDatasetDate - row.ultimaVisita) / (1000 * 60 * 60 * 24))),
      proporcionCortes: categoryShare("Cortes"),
      proporcionColor: categoryShare("Color"),
      proporcionEstetica: categoryShare("Estética"),
      proporcionTratamientos: categoryShare("Tratamientos"),
      proporcionUnas: categoryShare("Uñas"),
    };
  });
  const frequencies = dataset.map((row) => row.frecuencia);
  const result = {
    totalSyntheticInteractions: interactions.length,
    validTarget: interactions.length === 1000,
    oldAssociationRecordsRemaining: oldSeedCount,
    invalidInteractions,
    invalidServiceReferences,
    clusteringDatasetRows: dataset.length,
    totalItems,
    averageServicesPerInteraction: interactions.length ? Number((totalItems / interactions.length).toFixed(2)) : 0,
    minServicesPerInteraction: Number.isFinite(minItems) ? minItems : 0,
    maxServicesPerInteraction: maxItems,
    minInteractionsPerClient: frequencies.length ? Math.min(...frequencies) : 0,
    maxInteractionsPerClient: frequencies.length ? Math.max(...frequencies) : 0,
    datasetColumns: [
      "frecuencia", "gastoPromedio", "serviciosPromedio", "diasDesdeUltimaVisita",
      "proporcionCortes", "proporcionColor", "proporcionEstetica", "proporcionTratamientos", "proporcionUnas",
    ],
    sampleDataset: dataset.slice(0, 5),
  };
  console.log(JSON.stringify(result, null, 2));

  if (interactions.length !== 1000 || oldSeedCount !== 0 || invalidInteractions > 0 || invalidServiceReferences > 0) {
    throw new Error("La verificacion de los datos para clustering no fue satisfactoria.");
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
