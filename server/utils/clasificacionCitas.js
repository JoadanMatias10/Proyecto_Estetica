const { RandomForestClassifier } = require("ml-random-forest");
const { normalizeString } = require("./validadores");

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const NUMERIC_FEATURES = [
  { key: "horaCita", label: "Hora de la cita" },
  { key: "esFinSemana", label: "Fin de semana" },
  { key: "precioServicio", label: "Precio del servicio" },
  { key: "duracionMinutos", label: "Duracion del servicio" },
  { key: "diasAnticipacion", label: "Dias de anticipacion" },
  { key: "recordatorioActivo", label: "Recordatorio activo" },
  { key: "anticipacionRecordatorioHoras", label: "Anticipacion del recordatorio" },
  { key: "citasPrevias", label: "Citas previas" },
  { key: "cancelacionesPrevias", label: "Cancelaciones previas" },
  { key: "tasaCancelacionPrevia", label: "Tasa de cancelacion previa" },
  { key: "diasDesdeRegistroCliente", label: "Antiguedad del cliente" },
];

const CATEGORICAL_FEATURES = [
  { key: "mesCita", label: "Mes de la cita" },
  { key: "diaSemanaCita", label: "Dia de la semana" },
  { key: "servicio", label: "Servicio" },
  { key: "segmentoServicio", label: "Segmento del servicio" },
  { key: "subcategoriaServicio", label: "Subcategoria del servicio" },
  { key: "canalRecordatorio", label: "Canal del recordatorio" },
];

const DATASET_COLUMNS = [
  "mesCita",
  "diaSemanaCita",
  "horaCita",
  "esFinSemana",
  "diasAnticipacion",
  "servicio",
  "segmentoServicio",
  "subcategoriaServicio",
  "precioServicio",
  "duracionMinutos",
  "recordatorioActivo",
  "canalRecordatorio",
  "anticipacionRecordatorioHoras",
  "citasPrevias",
  "cancelacionesPrevias",
  "tasaCancelacionPrevia",
  "diasDesdeRegistroCliente",
  "citaCancelada",
];

function toDateOrNull(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(startValue, endValue) {
  const start = toDateOrNull(startValue);
  const end = toDateOrNull(endValue);
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY));
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseReminderHours(value) {
  const text = normalizeString(value).toLowerCase();
  const amount = Number(text.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(",", ".") || 0);
  if (!Number.isFinite(amount)) return 0;
  if (text.includes("semana")) return Math.round(amount * 24 * 7);
  if (text.includes("dia")) return Math.round(amount * 24);
  if (text.includes("minuto")) return Number((amount / 60).toFixed(2));
  return Math.round(amount);
}

function normalizeCategory(value, fallback = "Sin dato") {
  return normalizeString(value) || fallback;
}

function buildAppointmentClassificationDataset({ appointments, users, services }) {
  const orderedAppointments = [...appointments].sort((left, right) => {
    const leftDate = toDateOrNull(left.fechaHora)?.getTime() || 0;
    const rightDate = toDateOrNull(right.fechaHora)?.getTime() || 0;
    if (leftDate !== rightDate) return leftDate - rightDate;
    const leftCreated = toDateOrNull(left.createdAt)?.getTime() || 0;
    const rightCreated = toDateOrNull(right.createdAt)?.getTime() || 0;
    return leftCreated - rightCreated;
  });

  const userMap = new Map(
    users.map((user) => {
      const fullName = [user.nombre, user.apellidoPaterno, user.apellidoMaterno]
        .map((part) => normalizeString(part))
        .filter(Boolean)
        .join(" ");
      return [
        String(user._id),
        {
          nombre: fullName || "Cliente",
          createdAt: user.createdAt,
          recordatorioActivo: user.notificationPreferences?.appointmentReminders !== false,
          canalRecordatorio: normalizeCategory(user.reminderSettings?.canal, "Sin canal"),
          anticipacionRecordatorioHoras: parseReminderHours(user.reminderSettings?.anticipacion),
        },
      ];
    })
  );

  const serviceById = new Map(services.map((service) => [String(service._id), service]));
  const serviceByName = new Map(
    services.map((service) => [normalizeString(service.nombre).toLowerCase(), service])
  );
  const previousByUser = new Map();

  return orderedAppointments.map((appointment) => {
    const userId = String(appointment.userId || "");
    const previous = previousByUser.get(userId) || { completadas: 0, canceladas: 0 };
    const previousTotal = previous.completadas + previous.canceladas;
    const user = userMap.get(userId) || {
      nombre: "Cliente",
      createdAt: appointment.createdAt,
      recordatorioActivo: true,
      canalRecordatorio: "Sin canal",
      anticipacionRecordatorioHoras: 0,
    };
    const appointmentDate = toDateOrNull(appointment.fechaHora) || new Date();
    const createdAt = toDateOrNull(appointment.createdAt) || appointmentDate;
    const service = appointment.serviceId
      ? serviceById.get(String(appointment.serviceId))
      : serviceByName.get(normalizeString(appointment.servicio).toLowerCase());
    const estado = normalizeString(appointment.estado || "pendiente").toLowerCase();
    const citaCancelada = estado === "cancelada" ? 1 : 0;
    const dayIndex = appointmentDate.getDay();
    const row = {
      id: String(appointment._id),
      cliente: user.nombre,
      fecha: formatDate(appointmentDate),
      fechaHora: appointmentDate.toISOString(),
      mesCita: appointmentDate.getMonth() + 1,
      mesNombre: MONTH_NAMES[appointmentDate.getMonth()],
      diaSemanaCita: DAY_NAMES[dayIndex],
      horaCita: appointmentDate.getHours(),
      esFinSemana: dayIndex === 0 || dayIndex === 6 ? 1 : 0,
      servicio: normalizeCategory(appointment.servicio || service?.nombre, "Servicio"),
      segmentoServicio: normalizeCategory(service?.segmento, "Sin segmento"),
      subcategoriaServicio: normalizeCategory(service?.subcategoria, "Sin subcategoria"),
      precioServicio: Number(appointment.servicioPrecio || service?.precio || 0),
      duracionMinutos: Number(appointment.duracionMinutos || 30),
      diasAnticipacion: daysBetween(createdAt, appointmentDate),
      recordatorioActivo: user.recordatorioActivo ? 1 : 0,
      canalRecordatorio: user.canalRecordatorio,
      anticipacionRecordatorioHoras: Number(user.anticipacionRecordatorioHoras || 0),
      citasPrevias: previousTotal,
      cancelacionesPrevias: previous.canceladas,
      tasaCancelacionPrevia: previousTotal
        ? Number((previous.canceladas / previousTotal).toFixed(4))
        : 0,
      diasDesdeRegistroCliente: daysBetween(user.createdAt, createdAt),
      estado,
      citaCancelada,
    };

    if (estado === "cancelada") previous.canceladas += 1;
    if (estado === "completada") previous.completadas += 1;
    previousByUser.set(userId, previous);
    return row;
  });
}

function sortedUnique(rows, key) {
  return Array.from(new Set(rows.map((row) => normalizeCategory(row[key])))).sort((left, right) =>
    left.localeCompare(right, "es", { numeric: true })
  );
}

function buildAppointmentClassificationOptions(rows) {
  return {
    meses: Array.from(new Set(rows.map((row) => Number(row.mesCita)))).sort((a, b) => a - b),
    diasSemana: sortedUnique(rows, "diaSemanaCita"),
    servicios: sortedUnique(rows, "servicio"),
    segmentos: sortedUnique(rows, "segmentoServicio"),
    subcategorias: sortedUnique(rows, "subcategoriaServicio"),
    canalesRecordatorio: sortedUnique(rows, "canalRecordatorio"),
  };
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

function balanceTrainingRows(rows) {
  const byClass = new Map([
    [0, rows.filter((row) => Number(row.citaCancelada) === 0)],
    [1, rows.filter((row) => Number(row.citaCancelada) === 1)],
  ]);
  const targetSize = Math.max(byClass.get(0).length, byClass.get(1).length);
  const balanced = [];

  for (let index = 0; index < targetSize; index += 1) {
    for (const label of [0, 1]) {
      const classRows = byClass.get(label);
      if (classRows.length) balanced.push(classRows[index % classRows.length]);
    }
  }
  return balanced;
}

function classificationMetrics(actual, predicted) {
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;

  actual.forEach((label, index) => {
    const prediction = Number(predicted[index]);
    if (label === 1 && prediction === 1) truePositive += 1;
    if (label === 0 && prediction === 0) trueNegative += 1;
    if (label === 0 && prediction === 1) falsePositive += 1;
    if (label === 1 && prediction === 0) falseNegative += 1;
  });

  const total = actual.length;
  const precisionDenominator = truePositive + falsePositive;
  const recallDenominator = truePositive + falseNegative;
  const precision = precisionDenominator ? truePositive / precisionDenominator : 0;
  const recall = recallDenominator ? truePositive / recallDenominator : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    accuracy: total ? Number(((truePositive + trueNegative) / total).toFixed(4)) : 0,
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    confusionMatrix: {
      trueNegative,
      falsePositive,
      falseNegative,
      truePositive,
    },
  };
}

function trainAppointmentCancellationModel(rows) {
  const labelledRows = rows.filter((row) => [0, 1].includes(Number(row.citaCancelada)));
  const labels = new Set(labelledRows.map((row) => Number(row.citaCancelada)));
  if (labelledRows.length < 30 || labels.size < 2) {
    return {
      available: false,
      summary: {
        available: false,
        message: "Se requieren al menos 30 citas y registros de ambas clases para entrenar el modelo.",
      },
    };
  }

  const splitIndex = Math.min(
    labelledRows.length - 1,
    Math.max(20, Math.floor(labelledRows.length * 0.8))
  );
  const trainingRows = labelledRows.slice(0, splitIndex);
  const testRows = labelledRows.slice(splitIndex);
  const trainingLabels = new Set(trainingRows.map((row) => Number(row.citaCancelada)));
  if (trainingLabels.size < 2 || testRows.length === 0) {
    return {
      available: false,
      summary: {
        available: false,
        message: "La division cronologica no contiene ambas clases en el conjunto de entrenamiento.",
      },
    };
  }

  const encoder = buildFeatureEncoder(trainingRows);
  const balancedRows = balanceTrainingRows(trainingRows);
  const trainingSet = balancedRows.map((row) => encoder.vectorize(row));
  const trainingTargets = balancedRows.map((row) => Number(row.citaCancelada));
  const classifier = new RandomForestClassifier({
    seed: 42,
    maxFeatures: 0.65,
    replacement: false,
    nEstimators: 30,
    useSampleBagging: true,
    maxSamples: 0.75,
    treeOptions: {
      gainFunction: "gini",
      maxDepth: 10,
      minNumSamples: 4,
    },
  });
  classifier.train(trainingSet, trainingTargets);

  const testSet = testRows.map((row) => encoder.vectorize(row));
  const actual = testRows.map((row) => Number(row.citaCancelada));
  const predicted = classifier.predict(testSet).map(Number);
  const metrics = classificationMetrics(actual, predicted);
  let topFeatures = [];

  try {
    topFeatures = classifier
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
    classifier,
    encoder,
    summary: {
      available: true,
      name: "RandomForestClassifier",
      library: "ml-random-forest 2.1.0",
      estimators: 30,
      split: "cronologico 80/20",
      trainingRows: trainingRows.length,
      balancedTrainingRows: balancedRows.length,
      testRows: testRows.length,
      featureCount: encoder.featureNames.length,
      ...metrics,
      topFeatures,
    },
  };
}

function predictAppointmentCancellation(modelContext, input) {
  if (!modelContext?.available) return null;
  const row = {
    ...input,
    mesCita: Number(input.mesCita),
    horaCita: Number(input.horaCita),
    esFinSemana: ["Sabado", "Domingo"].includes(input.diaSemanaCita) ? 1 : 0,
    precioServicio: Number(input.precioServicio),
    duracionMinutos: Number(input.duracionMinutos),
    diasAnticipacion: Number(input.diasAnticipacion),
    recordatorioActivo: input.recordatorioActivo ? 1 : 0,
    anticipacionRecordatorioHoras: Number(input.anticipacionRecordatorioHoras),
    citasPrevias: Number(input.citasPrevias),
    cancelacionesPrevias: Number(input.cancelacionesPrevias),
    diasDesdeRegistroCliente: Number(input.diasDesdeRegistroCliente),
  };
  row.tasaCancelacionPrevia = row.citasPrevias
    ? Number((row.cancelacionesPrevias / row.citasPrevias).toFixed(4))
    : 0;

  const vector = modelContext.encoder.vectorize(row);
  const predictedClass = Number(modelContext.classifier.predict([vector])[0]);
  const probability = Number(modelContext.classifier.predictProbability([vector], 1)[0] || 0);
  const risk = Math.round(probability * 100);
  const level = risk >= 65 ? "Alto" : risk >= 35 ? "Medio" : "Bajo";

  return {
    risk,
    probability: Number(probability.toFixed(4)),
    predictedClass,
    level,
    confidence: predictedClass === 1 ? risk : 100 - risk,
    tasaCancelacionPrevia: row.tasaCancelacionPrevia,
  };
}

module.exports = {
  DATASET_COLUMNS,
  buildAppointmentClassificationDataset,
  buildAppointmentClassificationOptions,
  predictAppointmentCancellation,
  trainAppointmentCancellationModel,
};
