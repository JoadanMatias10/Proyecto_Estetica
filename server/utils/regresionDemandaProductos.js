const { RandomForestRegression } = require("ml-random-forest");
const { normalizeString } = require("./validadores");

const SYNTHETIC_SOURCE_TAG = "Semilla ML regresion demanda v1";
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const NUMERIC_FEATURES = [
  { key: "indiceMes", label: "Indice cronologico del mes" },
  { key: "anio", label: "Anio" },
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "mesObjetivo", label: "Mes que se desea predecir" },
  { key: "trimestreObjetivo", label: "Trimestre que se desea predecir" },
  { key: "transaccionesMes", label: "Transacciones del mes" },
  { key: "unidadesVendidasMes", label: "Unidades vendidas del mes" },
  { key: "unidadesMesAnterior", label: "Unidades del mes anterior" },
  { key: "promedioMovil3Meses", label: "Promedio movil de 3 meses" },
  { key: "promedioHistoricoProducto", label: "Promedio historico del producto" },
  { key: "unidadesMismoMesAnioAnterior", label: "Unidades del mismo mes del anio anterior" },
  { key: "demandaCategoriaMes", label: "Demanda mensual de la categoria" },
  { key: "participacionCategoriaMes", label: "Participacion del producto en su categoria" },
  { key: "diasConVenta", label: "Dias con venta" },
  { key: "precioPromedio", label: "Precio promedio" },
  { key: "ingresoMes", label: "Ingreso mensual del producto" },
  { key: "ticketPromedioProducto", label: "Ticket promedio del producto" },
  { key: "proporcionEfectivo", label: "Proporcion de pagos en efectivo" },
  { key: "proporcionTarjeta", label: "Proporcion de pagos con tarjeta" },
  { key: "proporcionTransferencia", label: "Proporcion de transferencias" },
];

const CATEGORICAL_FEATURES = [
  { key: "producto", label: "Producto" },
  { key: "categoria", label: "Categoria" },
  { key: "marca", label: "Marca" },
];

const DATASET_COLUMNS = [
  ...NUMERIC_FEATURES.map(({ key }) => key),
  ...CATEGORICAL_FEATURES.map(({ key }) => key),
  "demandaMesSiguiente",
];

function toDateOrNull(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeCategory(value, fallback = "Sin dato") {
  return normalizeString(value) || fallback;
}

function periodKey(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function nextPeriod(year, monthIndex) {
  const next = new Date(year, monthIndex + 1, 1);
  return {
    year: next.getFullYear(),
    monthIndex: next.getMonth(),
    key: periodKey(next.getFullYear(), next.getMonth()),
  };
}

function enumeratePeriods(startDate, endDate) {
  const periods = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  let index = 0;

  while (cursor <= end) {
    periods.push({
      key: periodKey(cursor.getFullYear(), cursor.getMonth()),
      year: cursor.getFullYear(),
      monthIndex: cursor.getMonth(),
      month: cursor.getMonth() + 1,
      monthName: MONTH_NAMES[cursor.getMonth()],
      index,
    });
    cursor.setMonth(cursor.getMonth() + 1);
    index += 1;
  }
  return periods;
}

function createMonthlyStats() {
  return {
    units: 0,
    revenue: 0,
    transactionIds: new Set(),
    saleDays: new Set(),
    paymentTransactions: {
      Efectivo: new Set(),
      Tarjeta: new Set(),
      Transferencia: new Set(),
    },
  };
}

function buildProductDemandRegressionDataset({ sales, products }) {
  const validSales = sales
    .filter((sale) => sale.estado !== "Anulada" && toDateOrNull(sale.createdAt))
    .sort((left, right) => toDateOrNull(left.createdAt) - toDateOrNull(right.createdAt));
  if (!validSales.length) {
    return { rows: [], periods: [], products: [], source: { transactions: 0, syntheticTransactions: 0 } };
  }

  const productById = new Map(products.map((product) => [String(product._id), product]));
  const usedProductIds = new Set();
  const statsByProductPeriod = new Map();
  const unitsByCategoryPeriod = new Map();
  let totalItemLines = 0;
  let totalUnits = 0;
  let totalRevenue = 0;

  validSales.forEach((sale) => {
    const date = toDateOrNull(sale.createdAt);
    const currentPeriod = periodKey(date.getFullYear(), date.getMonth());
    const saleId = String(sale._id);
    const dayKey = `${currentPeriod}-${String(date.getDate()).padStart(2, "0")}`;

    (Array.isArray(sale.items) ? sale.items : []).forEach((item) => {
      const productId = String(item.productId || "");
      if (!productId || !productById.has(productId)) return;
      const key = `${productId}::${currentPeriod}`;
      const stats = statsByProductPeriod.get(key) || createMonthlyStats();
      const product = productById.get(productId);
      const category = normalizeCategory(product?.categoria, "Sin categoria");
      const categoryPeriodKey = `${category}::${currentPeriod}`;
      const units = Math.max(0, Number(item.cantidad || 0));
      const revenue = Math.max(0, Number(item.subtotal || 0));

      usedProductIds.add(productId);
      stats.units += units;
      stats.revenue += revenue;
      stats.transactionIds.add(saleId);
      stats.saleDays.add(dayKey);
      if (stats.paymentTransactions[sale.metodoPago]) {
        stats.paymentTransactions[sale.metodoPago].add(saleId);
      }
      statsByProductPeriod.set(key, stats);
      unitsByCategoryPeriod.set(categoryPeriodKey, Number(unitsByCategoryPeriod.get(categoryPeriodKey) || 0) + units);
      totalItemLines += 1;
      totalUnits += units;
      totalRevenue += revenue;
    });
  });

  const firstDate = toDateOrNull(validSales[0].createdAt);
  const lastDate = toDateOrNull(validSales[validSales.length - 1].createdAt);
  const periods = enumeratePeriods(firstDate, lastDate);
  const usedProducts = products
    .filter((product) => usedProductIds.has(String(product._id)))
    .sort((left, right) => normalizeCategory(left.nombre).localeCompare(normalizeCategory(right.nombre), "es"));
  const rows = [];

  usedProducts.forEach((product) => {
    const productId = String(product._id);
    const history = [];
    let lastKnownPrice = Number(product.precio || 0);

    periods.forEach((period, periodIndex) => {
      const stats = statsByProductPeriod.get(`${productId}::${period.key}`) || createMonthlyStats();
      const transactions = stats.transactionIds.size;
      const units = Number(stats.units || 0);
      const revenue = Number(stats.revenue || 0);
      if (units > 0) lastKnownPrice = revenue / units;
      const recentUnits = [...history.slice(-2), units];
      const historicalUnits = [...history, units];
      const next = nextPeriod(period.year, period.monthIndex);
      const nextStats = statsByProductPeriod.get(`${productId}::${next.key}`);
      const hasKnownTarget = periodIndex < periods.length - 1;
      const category = normalizeCategory(product.categoria, "Sin categoria");
      const categoryDemand = Number(unitsByCategoryPeriod.get(`${category}::${period.key}`) || 0);
      const sameTargetMonthPreviousYear = periodIndex >= 11 ? Number(history[periodIndex - 11] || 0) : 0;

      rows.push({
        productId,
        periodo: period.key,
        periodoSiguiente: next.key,
        mesNombre: period.monthName,
        indiceMes: period.index,
        anio: period.year,
        mes: period.month,
        trimestre: Math.floor(period.monthIndex / 3) + 1,
        mesObjetivo: next.monthIndex + 1,
        trimestreObjetivo: Math.floor(next.monthIndex / 3) + 1,
        producto: normalizeCategory(product.nombre, "Producto"),
        categoria: category,
        marca: normalizeCategory(product.marca, "Sin marca"),
        transaccionesMes: transactions,
        unidadesVendidasMes: units,
        unidadesMesAnterior: Number(history[history.length - 1] || 0),
        promedioMovil3Meses: Number((recentUnits.reduce((sum, value) => sum + value, 0) / recentUnits.length).toFixed(4)),
        promedioHistoricoProducto: Number((historicalUnits.reduce((sum, value) => sum + value, 0) / historicalUnits.length).toFixed(4)),
        unidadesMismoMesAnioAnterior: sameTargetMonthPreviousYear,
        demandaCategoriaMes: categoryDemand,
        participacionCategoriaMes: categoryDemand ? Number((units / categoryDemand).toFixed(4)) : 0,
        diasConVenta: stats.saleDays.size,
        precioPromedio: Number(lastKnownPrice.toFixed(2)),
        ingresoMes: Number(revenue.toFixed(2)),
        ticketPromedioProducto: transactions ? Number((revenue / transactions).toFixed(2)) : 0,
        proporcionEfectivo: transactions ? Number((stats.paymentTransactions.Efectivo.size / transactions).toFixed(4)) : 0,
        proporcionTarjeta: transactions ? Number((stats.paymentTransactions.Tarjeta.size / transactions).toFixed(4)) : 0,
        proporcionTransferencia: transactions ? Number((stats.paymentTransactions.Transferencia.size / transactions).toFixed(4)) : 0,
        stockActual: Number(product.stock || 0),
        demandaMesSiguiente: hasKnownTarget ? Number(nextStats?.units || 0) : null,
      });
      history.push(units);
    });
  });

  rows.sort((left, right) => {
    const periodOrder = left.periodo.localeCompare(right.periodo);
    return periodOrder || left.producto.localeCompare(right.producto, "es");
  });

  return {
    rows,
    periods,
    products: usedProducts.map((product) => ({
      id: String(product._id),
      nombre: normalizeCategory(product.nombre, "Producto"),
      categoria: normalizeCategory(product.categoria, "Sin categoria"),
      marca: normalizeCategory(product.marca, "Sin marca"),
      stockActual: Number(product.stock || 0),
    })),
    source: {
      transactions: validSales.length,
      syntheticTransactions: validSales.filter((sale) => sale.usuario === SYNTHETIC_SOURCE_TAG).length,
      itemLines: totalItemLines,
      totalUnits,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      firstDate: firstDate.toISOString(),
      lastDate: lastDate.toISOString(),
    },
  };
}

function sortedUnique(rows, key) {
  return Array.from(new Set(rows.map((row) => normalizeCategory(row[key])))).sort((left, right) =>
    left.localeCompare(right, "es", { numeric: true })
  );
}

function buildFeatureEncoder(trainingRows) {
  const categoryValues = Object.fromEntries(
    CATEGORICAL_FEATURES.map(({ key }) => [key, sortedUnique(trainingRows, key)])
  );
  const featureNames = [
    ...NUMERIC_FEATURES.map(({ key, label }) => ({ key, label })),
    ...CATEGORICAL_FEATURES.flatMap(({ key, label }) =>
      categoryValues[key].map((value) => ({ key: `${key}=${value}`, label: `${label}: ${value}` }))
    ),
  ];

  return {
    featureNames,
    vectorize(row) {
      return [
        ...NUMERIC_FEATURES.map(({ key }) => {
          const value = Number(row[key]);
          return Number.isFinite(value) ? value : 0;
        }),
        ...CATEGORICAL_FEATURES.flatMap(({ key }) => {
          const current = normalizeCategory(row[key]);
          return categoryValues[key].map((value) => (value === current ? 1 : 0));
        }),
      ];
    },
  };
}

function regressionMetrics(actual, predicted) {
  const count = actual.length;
  if (!count) return { mae: 0, rmse: 0, r2: 0 };
  const mean = actual.reduce((sum, value) => sum + value, 0) / count;
  let absoluteError = 0;
  let squaredError = 0;
  let totalVariance = 0;

  actual.forEach((value, index) => {
    const error = value - predicted[index];
    absoluteError += Math.abs(error);
    squaredError += error * error;
    totalVariance += (value - mean) * (value - mean);
  });

  return {
    mae: Number((absoluteError / count).toFixed(4)),
    rmse: Number(Math.sqrt(squaredError / count).toFixed(4)),
    r2: Number((totalVariance ? 1 - (squaredError / totalVariance) : 0).toFixed(4)),
  };
}

function trainProductDemandModel(rows) {
  const labelledRows = rows.filter((row) =>
    row.demandaMesSiguiente !== null && Number.isFinite(Number(row.demandaMesSiguiente))
  );
  const periods = Array.from(new Set(labelledRows.map((row) => row.periodo))).sort();
  if (labelledRows.length < 100 || periods.length < 6) {
    return {
      available: false,
      summary: {
        available: false,
        message: "Se requieren al menos 100 filas y 6 meses completos para entrenar la regresion.",
      },
    };
  }

  const splitPeriodIndex = Math.min(periods.length - 1, Math.max(3, Math.floor(periods.length * 0.8)));
  const trainingPeriods = new Set(periods.slice(0, splitPeriodIndex));
  const testPeriods = new Set(periods.slice(splitPeriodIndex));
  const trainingRows = labelledRows.filter((row) => trainingPeriods.has(row.periodo));
  const testRows = labelledRows.filter((row) => testPeriods.has(row.periodo));
  if (!trainingRows.length || !testRows.length) {
    return {
      available: false,
      summary: { available: false, message: "La division cronologica no produjo conjuntos de entrenamiento y prueba." },
    };
  }

  const encoder = buildFeatureEncoder(trainingRows);
  const regressor = new RandomForestRegression({
    seed: 42,
    maxFeatures: 0.45,
    replacement: false,
    nEstimators: 20,
    selectionMethod: "mean",
    useSampleBagging: true,
    maxSamples: 0.65,
    noOOB: true,
    treeOptions: {
      maxDepth: 9,
      minNumSamples: 4,
    },
  });
  regressor.train(
    trainingRows.map((row) => encoder.vectorize(row)),
    trainingRows.map((row) => Number(row.demandaMesSiguiente))
  );

  const actual = testRows.map((row) => Number(row.demandaMesSiguiente));
  const predicted = regressor.predict(testRows.map((row) => encoder.vectorize(row))).map((value) => Math.max(0, Number(value)));
  const metrics = regressionMetrics(actual, predicted);
  const baselinePredicted = testRows.map((row) => Number(row.unidadesVendidasMes || 0));
  const baseline = regressionMetrics(actual, baselinePredicted);
  let topFeatures = [];

  try {
    topFeatures = regressor
      .featureImportance()
      .map((importance, index) => ({
        name: encoder.featureNames[index]?.label || `Variable ${index + 1}`,
        importance: Number.isFinite(importance) ? Number(importance.toFixed(4)) : 0,
      }))
      .filter((feature) => feature.importance > 0)
      .sort((left, right) => right.importance - left.importance)
      .slice(0, 8);
  } catch (_error) {
    topFeatures = [];
  }

  return {
    available: true,
    regressor,
    encoder,
    summary: {
      available: true,
      name: "RandomForestRegression",
      library: "ml-random-forest 2.1.0",
      estimators: 20,
      split: "cronologico por meses 80/20",
      trainingRows: trainingRows.length,
      trainingPeriods: trainingPeriods.size,
      testRows: testRows.length,
      testPeriods: testPeriods.size,
      featureCount: encoder.featureNames.length,
      ...metrics,
      baselineMae: baseline.mae,
      topFeatures,
    },
  };
}

function predictProductDemand(modelContext, row) {
  if (!modelContext?.available) throw new Error("El modelo de regresion no esta disponible.");
  const rawPrediction = modelContext.regressor.predict([modelContext.encoder.vectorize(row)])[0];
  const predictedDemand = Number(Math.max(0, Number(rawPrediction || 0)).toFixed(2));
  return {
    predictedDemand,
    suggestedUnits: Math.ceil(predictedDemand),
    forecastPeriod: row.periodoSiguiente,
  };
}

module.exports = {
  DATASET_COLUMNS,
  NUMERIC_FEATURES,
  CATEGORICAL_FEATURES,
  SYNTHETIC_SOURCE_TAG,
  buildProductDemandRegressionDataset,
  predictProductDemand,
  trainProductDemandModel,
};
