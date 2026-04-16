const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/Usuario");
const Appointment = require("../models/Cita");
const ProductCategory = require("../models/CategoriaProducto");
const ProductBrand = require("../models/MarcaProducto");
const Product = require("../models/Producto");
const ServiceCategory = require("../models/CategoriaServicio");
const Service = require("../models/Servicio");
const CompanyInfo = require("../models/InformacionEmpresa");
const CarouselSlide = require("../models/DiapositivaCarrusel");
const StaffMember = require("../models/MiembroPersonal");
const AccountAccessToken = require("../models/TokenAccesoCuenta");
const Promotion = require("../models/Promocion");
const Sale = require("../models/Venta");
const InventoryMovement = require("../models/MovimientoInventario");
const { verifyPassword } = require("../utils/contrasena");
const { createToken, verifyToken } = require("../utils/auth");
const { recordRecentOperation } = require("../utils/recentOperationTracker");
const {
  ACCOUNT_STATUS,
  INVITE_EXPIRATION_MS,
  canUseAdminPanel,
  createPlaceholderCredentials,
  issueAccessToken,
  mapStaffRoleToUserRole,
  mapUserRoleToStaffRole,
  sendInviteEmail,
} = require("../utils/accountAccess");
const { normalizeString } = require("../utils/validadores");
const {
  SERVICE_SEGMENTS,
  normalizeServiceSegment,
  normalizeServiceSegmentInRecord,
} = require("../utils/serviceSegments");

const router = express.Router();

const registrarAuthAdminRoutes = require("./administrador/authAdmin");
const registrarRespaldosAdminRoutes = require("./administrador/respaldosAdmin");
const registrarInventarioAdminRoutes = require("./administrador/inventarioAdmin");
const registrarStaffAdminRoutes = require("./administrador/staffAdmin");
const registrarCatalogoAdminRoutes = require("./administrador/catalogoAdmin");
const registrarMonitorAdminRoutes = require("./administrador/monitorAdmin");
const { productUpload, serviceUpload, carouselUpload } = require("../middleware/multer");
const cloudinary = require("../config/cloudinary");

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_POLICY_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_POLICY_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const PRODUCT_UNITS = new Set(["ml", "g"]);
const SALE_PAYMENT_METHODS = new Set(["Efectivo", "Tarjeta", "Transferencia"]);
const loginAttempts = new Map();
const historialRespaldos = [];
const LIMITE_HISTORIAL_RESPALDOS = 50;
const ETIQUETAS_COLECCIONES = {
  usuarios: "Usuarios",
  citas: "Citas",
  categorias_producto: "Categorias de producto",
  marcas_producto: "Marcas de producto",
  productos: "Productos",
  categorias_servicio: "Categorias de servicio",
  servicios: "Servicios",
  informacion_empresa: "Informacion de empresa",
  diapositivas_carrusel: "Diapositivas de carrusel",
  miembros_personal: "Miembros del personal",
  tokens_acceso_cuenta: "Tokens de acceso",
  promociones: "Promociones",
  ventas: "Ventas",
  movimientos_inventario: "Movimientos de inventario",
  configuracion_respaldo_automatico_admin: "Configuracion de respaldo automatico",
};

function mapId(record) {
  if (!record) return null;
  const mappedRecord = {
    id: record._id.toString(),
    ...record,
    _id: undefined,
    __v: undefined,
  };
  return normalizeServiceSegmentInRecord(mappedRecord);
}

function parseBooleanFlag(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "si", "sí", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  }
  if (typeof value === "number") return value === 1;
  return fallback;
}

function normalizeObjectIdList(values) {
  const source = Array.isArray(values) ? values : [];
  const uniqueIds = Array.from(new Set(source.map((value) => String(value || "").trim()).filter(Boolean)));
  return uniqueIds
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));
}

function mapCompanyInfo(record) {
  const source = record || {};
  return {
    nombre: source.nombre || "",
    direccion: source.direccion || "",
    telefono: source.telefono || "",
    email: source.email || "",
    mision: source.mision || "",
    vision: source.vision || "",
    valores: source.valores || "",
    facebook: source.facebook || "",
    instagram: source.instagram || "",
    quienesSomosTexto: source.quienesSomosTexto || "",
    quienesSomosEsencia: source.quienesSomosEsencia || "",
    horarioLunesSabado: source.horarioLunesSabado || "",
    horarioDomingo: source.horarioDomingo || "",
    mapLat: source.mapLat || "",
    mapLng: source.mapLng || "",
    mapZoom: source.mapZoom || "15",
    mapGoogleUrl: source.mapGoogleUrl || "",
    politicasDocumento: source.politicasDocumento || "",
    politicasDocumentoNombre: source.politicasDocumentoNombre || "",
    politicasDocumentoTipo: source.politicasDocumentoTipo || "",
  };
}

function mapSale(record) {
  const source = mapId(record);
  if (!source) return null;
  return {
    ...source,
    estado: source.estado === "Anulada" ? "Anulada" : "Activa",
    anuladaAt: source.anuladaAt || null,
    anuladaPor: source.anuladaPor || "",
    motivoAnulacion: source.motivoAnulacion || "",
    items: Array.isArray(source.items)
      ? source.items.map((item) => ({
        ...item,
        productId: item?.productId ? String(item.productId) : "",
      }))
      : [],
  };
}

function getKey(req, usuario) {
  return `${req.ip || "unknown"}:${usuario}`;
}

function getState(key) {
  const now = Date.now();
  const prev = loginAttempts.get(key);
  if (!prev || now - prev.firstAttemptAt > WINDOW_MS) {
    const next = { count: 0, firstAttemptAt: now, blockedUntil: 0 };
    loginAttempts.set(key, next);
    return next;
  }
  return prev;
}

function registerFailure(key) {
  const state = getState(key);
  state.count += 1;
  if (state.count >= MAX_ATTEMPTS) {
    state.blockedUntil = Date.now() + BLOCK_MS;
  }
  loginAttempts.set(key, state);
}

function clearState(key) {
  loginAttempts.delete(key);
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload || !canUseAdminPanel(payload.role)) {
    return res.status(401).json({ errors: ["No autorizado."] });
  }
  req.admin = payload;
  return next();
}

function sanitizeText(value) {
  return normalizeString(value);
}

function sanitizeState(value) {
  return value === "Inactiva" ? "Inactiva" : "Activa";
}

function sanitizeStaffStatus(value) {
  return value === "Inactivo" ? "Inactivo" : "Activo";
}

function sanitizeStaffRole(value) {
  const normalized = sanitizeText(value);
  const allowed = ["Administrador", "Estilista"];
  return allowed.includes(normalized) ? normalized : "Estilista";
}

function estimateBase64Bytes(base64Content) {
  const normalized = String(base64Content || "").replace(/\s+/g, "");
  if (!normalized) return 0;
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function sanitizeSegment(value) {
  return normalizeServiceSegment(value, SERVICE_SEGMENTS[0]);
}

function sanitizeInventoryAction(value) {
  return value === "Salida" ? "Salida" : "Entrada";
}

function sanitizeProductUnit(value) {
  const normalized = sanitizeText(value).toLowerCase();
  return PRODUCT_UNITS.has(normalized) ? normalized : "";
}

function sanitizeSalePaymentMethod(value) {
  const normalized = sanitizeText(value);
  return SALE_PAYMENT_METHODS.has(normalized) ? normalized : "";
}

function parsePositiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parsePositiveInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) return fallback;
  return parsed;
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findOneCaseInsensitive(Model, field, value, excludeId = null, extraFilter = {}) {
  const regex = new RegExp(`^${escapeRegex(value)}$`, "i");
  const query = { ...extraFilter, [field]: regex };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return Model.findOne(query);
}

async function normalizeCarouselOrder() {
  const slides = await CarouselSlide.find().sort({ orden: 1, createdAt: 1 });
  await Promise.all(
    slides.map((slide, index) => {
      if (slide.orden === index) return Promise.resolve();
      return CarouselSlide.updateOne({ _id: slide._id }, { orden: index });
    })
  );
}

async function syncAdminUsersAsStaff() {
  const adminUsers = await User.find({ role: { $in: ["admin", "stylist"] } })
    .select("nombre username correo telefono role accountStatus")
    .lean();

  for (const adminUser of adminUsers) {
    const email = sanitizeText(adminUser.correo).toLowerCase();
    const telefono = sanitizeText(adminUser.telefono);
    const nombre = sanitizeText(adminUser.nombre || adminUser.username || "Administrador");
    const rol = mapUserRoleToStaffRole(adminUser.role) || "Estilista";
    const estado = adminUser.accountStatus === ACCOUNT_STATUS.INACTIVE ? "Inactivo" : "Activo";
    if (!email || !telefono || !nombre) continue;

    const byEmail = await findOneCaseInsensitive(StaffMember, "email", email);
    if (byEmail) {
      byEmail.userId = adminUser._id;
      byEmail.nombre = nombre;
      byEmail.rol = rol;
      byEmail.telefono = telefono;
      byEmail.estado = estado;
      await byEmail.save();
      continue;
    }

    const byPhone = await StaffMember.findOne({ telefono });
    if (byPhone) {
      byPhone.userId = adminUser._id;
      byPhone.nombre = nombre;
      byPhone.rol = rol;
      byPhone.email = email;
      byPhone.estado = estado;
      await byPhone.save();
      continue;
    }

    await StaffMember.create({
      userId: adminUser._id,
      nombre,
      rol,
      email,
      telefono,
      estado,
    });
  }
}

function getPeriodConfig(periodRaw) {
  const period = normalizeString(periodRaw || "Mes");
  if (period === "Semana") {
    return { period: "Semana", days: 7 };
  }
  if (period === "Ano" || period === "Año") {
    return { period: "Ano", days: 365 };
  }
  return { period: "Mes", days: 30 };
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function getStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEndOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function parseDateInput(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  const localDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (localDateMatch) {
    const year = Number(localDateMatch[1]);
    const monthIndex = Number(localDateMatch[2]) - 1;
    const day = Number(localDateMatch[3]);
    const parsed = new Date(year, monthIndex, day);

    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === monthIndex &&
      parsed.getDate() === day
    ) {
      return parsed;
    }
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

// Construye un rango de fecha de forma segura para Mongo: solo fechas válidas.
function buildDateRangeFilter(fromDate, toDate) {
  const safeFrom = fromDate instanceof Date && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
  const safeTo = toDate instanceof Date && !Number.isNaN(toDate.getTime()) ? toDate : null;

  if (!safeFrom && !safeTo) return {};

  const dateRange = {};
  if (safeFrom) dateRange.$gte = safeFrom;
  if (safeTo) dateRange.$lte = safeTo;
  return dateRange;
}

function buildFieldDateQuery(field, fromDate, toDate) {
  const dateRange = buildDateRangeFilter(fromDate, toDate);
  if (!Object.keys(dateRange).length) return {};
  return { [field]: dateRange };
}

function buildBuckets(period, now) {
  if (period === "Semana") {
    const labels = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
    const start = getStartOfDay(addDays(now, -6));
    return Array.from({ length: 7 }).map((_, idx) => {
      const day = addDays(start, idx);
      const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
      return { key, label: labels[day.getDay()], servicios: 0, productos: 0 };
    });
  }

  if (period === "Ano") {
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const currentYear = now.getFullYear();
    return Array.from({ length: 12 }).map((_, idx) => ({
      key: `${currentYear}-${idx}`,
      label: monthNames[idx],
      servicios: 0,
      productos: 0,
    }));
  }

  // Mes: ultimas 4 semanas.
  const start = getStartOfDay(addDays(now, -27));
  return Array.from({ length: 4 }).map((_, idx) => ({
    key: `w-${idx}`,
    label: `Sem ${idx + 1}`,
    servicios: 0,
    productos: 0,
    start: addDays(start, idx * 7),
    end: addDays(start, idx * 7 + 6),
  }));
}

function getWeekBucketIndex(date, buckets) {
  return buckets.findIndex((bucket) => date >= bucket.start && date <= bucket.end);
}

function crearIdRespaldo() {
  return `rsp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function obtenerEtiquetaColeccion(nombreColeccion) {
  return ETIQUETAS_COLECCIONES[nombreColeccion] || nombreColeccion;
}

async function obtenerNombresColeccionesDisponibles() {
  const db = mongoose.connection.db;
  const resultado = await db.listCollections({}, { nameOnly: true }).toArray();
  return resultado
    .map((coleccion) => String(coleccion.name || ""))
    .filter((nombre) => nombre && !nombre.startsWith("system."));
}

async function obtenerResumenColeccion(nombreColeccion) {
  const db = mongoose.connection.db;
  const coleccion = db.collection(nombreColeccion);
  let cantidadDocumentos = 0;
  let tamanoBytes = 0;
  try {
    const stats = await db.command({ collStats: nombreColeccion });
    cantidadDocumentos = Number(stats?.count || 0);
    tamanoBytes = Number(stats?.size || 0);
  } catch (_error) {
    cantidadDocumentos = await coleccion.estimatedDocumentCount().catch(() => 0);
    tamanoBytes = 0;
  }

  return {
    nombre: nombreColeccion,
    etiqueta: obtenerEtiquetaColeccion(nombreColeccion),
    cantidadDocumentos,
    tamanoBytes,
    tamanoMb: Number((tamanoBytes / (1024 * 1024)).toFixed(2)),
  };
}

function guardarResumenEnHistorial(resumen) {
  historialRespaldos.unshift(resumen);
  if (historialRespaldos.length > LIMITE_HISTORIAL_RESPALDOS) {
    historialRespaldos.length = LIMITE_HISTORIAL_RESPALDOS;
  }
}

function padMonthNumber(value) {
  return String(value).padStart(2, "0");
}

function buildPredictiveMonthKeys(referenceDate, count = 12) {
  return Array.from({ length: count }, (_, index) => {
    const current = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() - count + 1 + index,
      1
    );
    return `${current.getFullYear()}-${padMonthNumber(current.getMonth() + 1)}`;
  });
}

function linearRegressionSeries(values) {
  const series = Array.isArray(values) ? values.map((value) => Number(value || 0)) : [];
  const n = series.length;
  if (!n) return { m: 0, b: 0 };

  const xs = series.map((_, index) => index);
  const sumX = xs.reduce((total, value) => total + value, 0);
  const sumY = series.reduce((total, value) => total + value, 0);
  const sumXY = xs.reduce((total, value, index) => total + value * series[index], 0);
  const sumX2 = xs.reduce((total, value) => total + value * value, 0);
  const denominator = n * sumX2 - sumX * sumX;

  if (!denominator) {
    return { m: 0, b: sumY / n };
  }

  return {
    m: (n * sumXY - sumX * sumY) / denominator,
    b: (sumY - ((n * sumXY - sumX * sumY) / denominator) * sumX) / n,
  };
}

function predictSeriesValue(values, stepsAhead = 1) {
  const series = Array.isArray(values) ? values.map((value) => Number(value || 0)) : [];
  const { m, b } = linearRegressionSeries(series);
  const nextX = series.length - 1 + stepsAhead;
  return Math.max(0, Math.round(m * nextX + b));
}

function sumPredictedDemand(values, months) {
  return Array.from({ length: months }, (_, index) => predictSeriesValue(values, index + 1)).reduce(
    (total, value) => total + value,
    0
  );
}

function roundMetric(value, decimals = 1) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

function calculatePredictiveError(values) {
  const series = Array.isArray(values) ? values.map((value) => Number(value || 0)) : [];
  if (series.length < 4) {
    return { errorRate: null, evaluatedMonths: 0 };
  }

  let totalAbsoluteError = 0;
  let totalActual = 0;
  let evaluatedMonths = 0;

  for (let index = 3; index < series.length; index += 1) {
    const actual = Number(series[index] || 0);
    const predicted = predictSeriesValue(series.slice(0, index), 1);
    totalAbsoluteError += Math.abs(actual - predicted);
    totalActual += actual;
    evaluatedMonths += 1;
  }

  if (!evaluatedMonths || totalActual <= 0) {
    return { errorRate: null, evaluatedMonths };
  }

  return {
    errorRate: roundMetric((totalAbsoluteError / totalActual) * 100, 1),
    evaluatedMonths,
  };
}

function calculatePredictiveConfidence({ monthsWithData, errorRate, evaluatedMonths, totalUnits }) {
  let score = 100;

  if (monthsWithData < 8) score -= 20;
  if (monthsWithData < 5) score -= 20;
  if (evaluatedMonths < 4) score -= 15;
  if (totalUnits < 24) score -= 10;

  if (errorRate === null) {
    score -= 20;
  } else if (errorRate > 45) {
    score -= 35;
  } else if (errorRate > 30) {
    score -= 20;
  } else if (errorRate > 20) {
    score -= 10;
  }

  const normalizedScore = Math.max(15, Math.min(100, score));
  if (normalizedScore >= 75) return { level: "Alta", score: normalizedScore };
  if (normalizedScore >= 50) return { level: "Media", score: normalizedScore };
  return { level: "Baja", score: normalizedScore };
}

function buildPredictiveCategorySummary({
  values,
  lastSaleAt,
  stockActual,
  totalProducts,
  generatedAt,
}) {
  const series = Array.isArray(values) ? values.map((value) => Number(value || 0)) : [];
  const monthsAnalyzed = series.length;
  const monthsWithData = series.filter((value) => value > 0).length;
  const totalUnits = series.reduce((total, value) => total + value, 0);
  const lastMonthSales = Number(series[series.length - 1] || 0);
  const nextMonth = predictSeriesValue(series, 1);
  const next3Months = sumPredictedDemand(series, 3);
  const next6Months = sumPredictedDemand(series, 6);
  const { m: trendSlope } = linearRegressionSeries(series);
  const averageProjectedMonthly = next3Months > 0 ? next3Months / 3 : 0;
  const stockCoverageMonths = averageProjectedMonthly > 0
    ? roundMetric(stockActual / averageProjectedMonthly, 1)
    : null;
  const suggestedRestock = Math.max(0, Math.ceil(next3Months * 1.1 - stockActual));
  const riskBreakage = stockActual < nextMonth || (stockCoverageMonths !== null && stockCoverageMonths < 1.5);
  const riskOverstock = stockActual > 0 && (next3Months === 0 || (stockCoverageMonths !== null && stockCoverageMonths > 6));
  const { errorRate, evaluatedMonths } = calculatePredictiveError(series);
  const confidence = calculatePredictiveConfidence({
    monthsWithData,
    errorRate,
    evaluatedMonths,
    totalUnits,
  });

  return {
    monthsAnalyzed,
    monthsWithData,
    totalUnits,
    lastMonthSales,
    lastSaleAt: lastSaleAt ? new Date(lastSaleAt).toISOString() : null,
    generatedAt: generatedAt.toISOString(),
    totalProducts,
    stockActual,
    trendSlope: roundMetric(trendSlope, 2),
    projectedNextMonth: nextMonth,
    projected3Months: next3Months,
    projected6Months: next6Months,
    errorRate,
    evaluatedMonths,
    confidence,
    stockCoverageMonths,
    suggestedRestock,
    riskBreakage,
    riskOverstock,
  };
}

function buildPredictiveProductSummary({
  productId,
  nombre,
  marca,
  values,
  lastSaleAt,
  stockActual,
}) {
  const series = Array.isArray(values) ? values.map((value) => Number(value || 0)) : [];
  const monthsWithData = series.filter((value) => value > 0).length;
  const totalUnits = series.reduce((total, value) => total + value, 0);
  const projectedNextMonth = predictSeriesValue(series, 1);
  const projected3Months = sumPredictedDemand(series, 3);
  const projected6Months = sumPredictedDemand(series, 6);
  const avgProjectedMonthly = projected3Months > 0 ? projected3Months / 3 : 0;
  const stockCoverageMonths = avgProjectedMonthly > 0
    ? roundMetric(stockActual / avgProjectedMonthly, 1)
    : null;
  const suggestedRestock = Math.max(0, Math.ceil(projected3Months * 1.05 - stockActual));
  const riskBreakage = stockActual < projectedNextMonth || (stockCoverageMonths !== null && stockCoverageMonths < 1.5);
  const riskOverstock = stockActual > 0 && (projected3Months === 0 || (stockCoverageMonths !== null && stockCoverageMonths > 6));
  const lowRotation = totalUnits <= 6 && monthsWithData <= 2 && stockActual > 0;

  return {
    productId: productId ? String(productId) : "",
    nombre: String(nombre || "Producto sin nombre"),
    marca: String(marca || "Sin marca"),
    totalUnits,
    monthsWithData,
    lastSaleAt: lastSaleAt ? new Date(lastSaleAt).toISOString() : null,
    stockActual,
    projectedNextMonth,
    projected3Months,
    projected6Months,
    stockCoverageMonths,
    suggestedRestock,
    riskBreakage,
    riskOverstock,
    lowRotation,
  };
}

function buildPredictiveAlerts(categorySummaries, productBreakdown) {
  const alerts = [];
  const severityWeight = { Alta: 3, Media: 2, Baja: 1 };

  Object.entries(categorySummaries || {}).forEach(([categoryName, summary]) => {
    if (summary?.riskBreakage) {
      alerts.push({
        id: `cat-break-${categoryName}`,
        severity: "Alta",
        type: "stock",
        category: categoryName,
        title: `Riesgo de quiebre en ${categoryName}`,
        description: summary.suggestedRestock > 0
          ? `El stock actual no cubre la demanda estimada. Conviene reponer al menos ${summary.suggestedRestock} uds.`
          : "La cobertura estimada es baja frente a la demanda del proximo mes.",
        metric: `${summary.stockCoverageMonths ?? "N/D"} meses`,
      });
    }

    if (summary?.riskOverstock) {
      alerts.push({
        id: `cat-over-${categoryName}`,
        severity: "Media",
        type: "stock",
        category: categoryName,
        title: `Sobrestock probable en ${categoryName}`,
        description: "El inventario disponible supera con amplitud la demanda esperada. Conviene revisar compras o impulsar promociones.",
        metric: `${summary.stockCoverageMonths ?? "N/D"} meses`,
      });
    }

    if (summary?.confidence?.level === "Baja") {
      alerts.push({
        id: `cat-confidence-${categoryName}`,
        severity: "Media",
        type: "modelo",
        category: categoryName,
        title: `Pronostico de baja confianza en ${categoryName}`,
        description: "La categoria tiene pocos meses con ventas o error historico elevado. Toma el pronostico como referencia y no como valor definitivo.",
        metric: `${summary.confidence?.score || 0}/100`,
      });
    }

    if (summary?.lastMonthSales > 0 && summary?.projectedNextMonth >= summary.lastMonthSales * 1.35) {
      alerts.push({
        id: `cat-growth-${categoryName}`,
        severity: "Media",
        type: "demanda",
        category: categoryName,
        title: `Crecimiento fuerte esperado en ${categoryName}`,
        description: "La proyeccion del proximo mes acelera con fuerza respecto al ultimo mes real. Conviene anticipar compras y preparacion operativa.",
        metric: `${summary.projectedNextMonth} uds.`,
      });
    }

    if (summary?.lastMonthSales > 0 && summary?.projectedNextMonth <= summary.lastMonthSales * 0.7) {
      alerts.push({
        id: `cat-drop-${categoryName}`,
        severity: "Baja",
        type: "demanda",
        category: categoryName,
        title: `Desaceleracion esperada en ${categoryName}`,
        description: "La proyeccion cae respecto al ultimo mes real. Puede ser una señal para revisar promociones o compras futuras.",
        metric: `${summary.projectedNextMonth} uds.`,
      });
    }

    const products = Array.isArray(productBreakdown?.[categoryName]) ? productBreakdown[categoryName] : [];

    products
      .filter((product) => product.riskBreakage)
      .sort((left, right) => (right.suggestedRestock - left.suggestedRestock) || (right.projected3Months - left.projected3Months))
      .slice(0, 2)
      .forEach((product) => {
        alerts.push({
          id: `product-break-${categoryName}-${product.productId || product.nombre}`,
          severity: "Alta",
          type: "producto",
          category: categoryName,
          productId: product.productId,
          productName: product.nombre,
          title: `Reabasto sugerido: ${product.nombre}`,
          description: `La demanda estimada del producto supera su stock actual. Conviene reponer ${product.suggestedRestock} uds.`,
          metric: `${product.suggestedRestock} uds.`,
        });
      });

    products
      .filter((product) => product.lowRotation)
      .sort((left, right) => right.stockActual - left.stockActual)
      .slice(0, 1)
      .forEach((product) => {
        alerts.push({
          id: `product-rotation-${categoryName}-${product.productId || product.nombre}`,
          severity: "Baja",
          type: "producto",
          category: categoryName,
          productId: product.productId,
          productName: product.nombre,
          title: `Baja rotacion: ${product.nombre}`,
          description: "El producto mantiene stock, pero ha tenido muy poca salida en la ventana analizada. Conviene revisar compra o exhibicion.",
          metric: `${product.stockActual} uds.`,
        });
      });
  });

  return alerts
    .sort((left, right) => {
      const bySeverity = (severityWeight[right.severity] || 0) - (severityWeight[left.severity] || 0);
      if (bySeverity !== 0) return bySeverity;
      return String(left.title || "").localeCompare(String(right.title || ""), "es");
    })
    .slice(0, 12);
}

registrarAuthAdminRoutes(router, {
  normalizeString,
  getKey,
  getState,
  registerFailure,
  clearState,
  canUseAdminPanel,
  User,
  verifyPassword,
  createToken,
  verifyToken,
});

router.use(requireAdmin);

registrarRespaldosAdminRoutes(router, {
  sanitizeText,
  obtenerNombresColeccionesDisponibles,
  obtenerResumenColeccion,
  historialRespaldos,
  crearIdRespaldo,
  guardarResumenEnHistorial,
  mongoose,
});

registrarInventarioAdminRoutes(router, {
  sanitizeText,
  sanitizeInventoryAction,
  parsePositiveNumber,
  findOneCaseInsensitive,
  Product,
  InventoryMovement,
  mapId,
});

registrarStaffAdminRoutes(router, {
  syncAdminUsersAsStaff,
  StaffMember,
  mapId,
  sanitizeText,
  sanitizeStaffRole,
  sanitizeStaffStatus,
  findOneCaseInsensitive,
  User,
  AccountAccessToken,
  ACCOUNT_STATUS,
  INVITE_EXPIRATION_MS,
  createPlaceholderCredentials,
  issueAccessToken,
  mapStaffRoleToUserRole,
  sendInviteEmail,
  isValidId,
});

registrarCatalogoAdminRoutes(router, {
  ProductCategory,
  ProductBrand,
  Product,
  ServiceCategory,
  Service,
  CompanyInfo,
  CarouselSlide,
  sanitizeText,
  sanitizeState,
  sanitizeSegment,
  sanitizeProductUnit,
  sanitizeSalePaymentMethod,
  parsePositiveNumber,
  parsePositiveInteger,
  isValidId,
  findOneCaseInsensitive,
  mapId,
  mapCompanyInfo,
  normalizeCarouselOrder,
  estimateBase64Bytes,
  ALLOWED_POLICY_DOCUMENT_TYPES,
  MAX_POLICY_DOCUMENT_BYTES,
  upload: productUpload,
  serviceUpload,
  carouselUpload,
  cloudinary,
});

registrarMonitorAdminRoutes(router, {
  mongoose,
  User,
  Appointment,
  ProductCategory,
  ProductBrand,
  Product,
  ServiceCategory,
  Service,
  CompanyInfo,
  CarouselSlide,
  StaffMember,
  AccountAccessToken,
  Promotion,
  Sale,
  InventoryMovement,
  obtenerNombresColeccionesDisponibles,
  obtenerResumenColeccion,
  obtenerEtiquetaColeccion,
  historialRespaldos,
});


router.get("/stats", async (req, res) => {
  const config = getPeriodConfig(req.query.period);
  const now = new Date();
  const startDate = addDays(now, -(config.days - 1));
  const buckets = buildBuckets(config.period, now);
  // Filtro reutilizable ya sanitizado para fecha de creación.
  const createdAtFilter = buildFieldDateQuery("createdAt", startDate);
  
  const [products, services, appointments, newClients] = await Promise.all([
    Product.find({ ...createdAtFilter }).select("precio createdAt").lean(),
    Service.find({ ...createdAtFilter }).select("precio createdAt").lean(),
    Appointment.find({ ...createdAtFilter }).select("createdAt").lean(),
    User.find({ role: "client", ...createdAtFilter }).select("createdAt").lean(),
  ]);

  const totalProductos = products.reduce((sum, product) => sum + Number(product.precio || 0), 0);
  const totalServicios = services.reduce((sum, service) => sum + Number(service.precio || 0), 0);
  const totalValue = totalProductos + totalServicios;
  const allPrices = [...products, ...services].map((item) => Number(item.precio || 0)).filter((value) => Number.isFinite(value) && value > 0);
  const ticketPromedio = allPrices.length
    ? allPrices.reduce((sum, value) => sum + value, 0) / allPrices.length
    : 0;

  const comparison = buckets.map((bucket) => ({
    label: bucket.label,
    servicios: 0,
    productos: 0,
  }));

  products.forEach((product) => {
    const createdAt = new Date(product.createdAt);
    if (config.period === "Semana") {
      const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}`;
      const index = buckets.findIndex((bucket) => bucket.key === key);
      if (index >= 0) comparison[index].productos += Number(product.precio || 0);
      return;
    }
    if (config.period === "Ano") {
      const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
      const index = buckets.findIndex((bucket) => bucket.key === key);
      if (index >= 0) comparison[index].productos += Number(product.precio || 0);
      return;
    }
    const index = getWeekBucketIndex(createdAt, buckets);
    if (index >= 0) comparison[index].productos += Number(product.precio || 0);
  });

  services.forEach((service) => {
    const createdAt = new Date(service.createdAt);
    if (config.period === "Semana") {
      const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}`;
      const index = buckets.findIndex((bucket) => bucket.key === key);
      if (index >= 0) comparison[index].servicios += Number(service.precio || 0);
      return;
    }
    if (config.period === "Ano") {
      const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
      const index = buckets.findIndex((bucket) => bucket.key === key);
      if (index >= 0) comparison[index].servicios += Number(service.precio || 0);
      return;
    }
    const index = getWeekBucketIndex(createdAt, buckets);
    if (index >= 0) comparison[index].servicios += Number(service.precio || 0);
  });

  const distributionRaw = {
    servicios: totalServicios,
    productos: totalProductos,
    otros: (appointments.length + newClients.length) * 50,
  };

  const distributionTotal = distributionRaw.servicios + distributionRaw.productos + distributionRaw.otros;
  const distribution = {
    servicios: distributionTotal ? (distributionRaw.servicios / distributionTotal) * 100 : 0,
    productos: distributionTotal ? (distributionRaw.productos / distributionTotal) * 100 : 0,
    otros: distributionTotal ? (distributionRaw.otros / distributionTotal) * 100 : 0,
  };

  return res.json({
    period: config.period,
    kpis: {
      ingresosTotales: totalValue,
      citasAtendidas: appointments.length,
      ticketPromedio,
      nuevosClientes: newClients.length,
    },
    comparison,
    distribution,
  });
});

router.get("/reports", async (req, res) => {
  const tipo = normalizeString(req.query.tipo || "Todos");
  const desdeRaw = normalizeString(req.query.desde || "");
  const hastaRaw = normalizeString(req.query.hasta || "");

  if (!["Todos", "Venta", "Servicio"].includes(tipo)) {
    return res.status(400).json({ errors: ["Tipo de reporte invalido."] });
  }

  let desde = null;
  let hasta = null;

  if (desdeRaw) {
    const parsedDesde = parseDateInput(desdeRaw);
    if (!parsedDesde) {
      return res.status(400).json({ errors: ["Fecha inicio invalida."] });
    }
    desde = getStartOfDay(parsedDesde);
  }

  if (hastaRaw) {
    const parsedHasta = parseDateInput(hastaRaw);
    if (!parsedHasta) {
      return res.status(400).json({ errors: ["Fecha fin invalida."] });
    }
    hasta = getEndOfDay(parsedHasta);
  }

  if (desde && hasta && desde > hasta) {
    return res.status(400).json({ errors: ["La fecha inicio no puede ser mayor que la fecha fin."] });
  }

  const saleFilter = buildFieldDateQuery("createdAt", desde, hasta);
  saleFilter.estado = { $ne: "Anulada" };
  // Filtro de fecha para citas por fechaHora, construido con mismo patrón seguro.
  const appointmentFilter = buildFieldDateQuery("fechaHora", desde, hasta);

  const shouldIncludeProducts = tipo === "Todos" || tipo === "Venta";
  const shouldIncludeServices = tipo === "Todos" || tipo === "Servicio";

  const [products, appointments, services] = await Promise.all([
    shouldIncludeProducts
      ? Sale.find(saleFilter)
           .select("items createdAt usuario total")
           .lean()
      : Promise.resolve([]),
    shouldIncludeServices
      ? Appointment.find(appointmentFilter)
           .select("servicio fechaHora userId")
           .lean()
      : Promise.resolve([]),
    shouldIncludeServices
      ? Service.find().select("nombre precio").lean()
      : Promise.resolve([]),
  ]);

  let userMap = new Map();
  if (shouldIncludeServices && appointments.length > 0) {
    const userIds = Array.from(new Set(appointments.map((appointment) => String(appointment.userId)).filter(Boolean)));
    if (userIds.length > 0) {
      // Previene inyección/errores por IDs inválidos antes de usar $in.
      const safeUserIds = userIds.filter((userId) => isValidId(userId)).map((userId) => new mongoose.Types.ObjectId(userId));
      if (!safeUserIds.length) {
        userMap = new Map();
      } else {
        const users = await User.find({ _id: { $in: safeUserIds } }).select("nombre apellidoPaterno apellidoMaterno").lean();
        userMap = new Map(
          users.map((user) => {
            const fullName = [user.nombre, user.apellidoPaterno, user.apellidoMaterno]
              .map((part) => normalizeString(part))
              .filter(Boolean)
              .join(" ");
            return [String(user._id), fullName || "Cliente"];
          })
        );
      }
    }
  }

  const servicePriceMap = new Map(
    services.map((service) => [normalizeString(service.nombre).toLowerCase(), Number(service.precio || 0)])
  );

  const productRows = products.map((sale) => ({
    id: `sale-${sale._id}`,
    fecha: sale.createdAt,
    tipo: "Venta",
    detalle: Array.isArray(sale.items) ? sale.items.map(i => `${i.cantidad}x ${i.producto || 'Producto'}`).join(", ") : "Venta de productos",
    monto: Number(sale.total || 0),
    usuario: sale.usuario || "Admin",
  }));

  const serviceRows = appointments.map((appointment) => ({
    id: `appt-${appointment._id}`,
    fecha: appointment.fechaHora || appointment.createdAt,
    tipo: "Servicio",
    detalle: appointment.servicio,
    monto: servicePriceMap.get(normalizeString(appointment.servicio).toLowerCase()) || 0,
    usuario: userMap.get(String(appointment.userId)) || "Cliente",
  }));

  const rows = [...productRows, ...serviceRows]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .map((row) => ({
      ...row,
      fecha: new Date(row.fecha).toISOString().slice(0, 10),
    }));

  const total = rows.reduce((sum, row) => sum + Number(row.monto || 0), 0);
  const totalVentas = rows
    .filter((row) => row.tipo === "Venta")
    .reduce((sum, row) => sum + Number(row.monto || 0), 0);
  const totalServicios = rows
    .filter((row) => row.tipo === "Servicio")
    .reduce((sum, row) => sum + Number(row.monto || 0), 0);

  return res.json({
    filters: {
      tipo,
      desde: desdeRaw,
      hasta: hastaRaw,
    },
    summary: {
      total,
      totalVentas,
      totalServicios,
      totalRegistros: rows.length,
    },
    rows,
  });
});

router.get("/sales", async (req, res) => {
  const desdeRaw = sanitizeText(req.query.desde || "");
  const hastaRaw = sanitizeText(req.query.hasta || "");

  let desde = null;
  let hasta = null;

  if (desdeRaw) {
    const parsedDesde = parseDateInput(desdeRaw);
    if (!parsedDesde) {
      return res.status(400).json({ errors: ["Fecha inicio invalida."] });
    }
    desde = getStartOfDay(parsedDesde);
  }

  if (hastaRaw) {
    const parsedHasta = parseDateInput(hastaRaw);
    if (!parsedHasta) {
      return res.status(400).json({ errors: ["Fecha fin invalida."] });
    }
    hasta = getEndOfDay(parsedHasta);
  }

  if (desde && hasta && desde > hasta) {
    return res.status(400).json({ errors: ["La fecha inicio no puede ser mayor que la fecha fin."] });
  }

  // Se arma el query con helper seguro para evitar variantes inválidas en filtros de fecha.
  const query = buildFieldDateQuery("createdAt", desde, hasta);
  const sales = await Sale.find(query).sort({ createdAt: -1 }).lean();
  const mappedSales = sales.map(mapSale);
  const total = mappedSales
    .filter((sale) => sale.estado !== "Anulada")
    .reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const totalAnuladas = mappedSales.filter((sale) => sale.estado === "Anulada").length;

  return res.json({
    filters: {
      desde: desdeRaw,
      hasta: hastaRaw,
    },
    summary: {
      total,
      totalVentas: total,
      totalRegistros: mappedSales.length,
      totalAnuladas,
    },
    sales: mappedSales,
  });
});

router.get("/sales/predictive", async (req, res) => {
  try {
    const today = new Date();
    const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    
    const salesPipeline = [
      { $match: { estado: "Activa", createdAt: { $gte: twelveMonthsAgo } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "productos",
          localField: "items.productId",
          foreignField: "_id",
          as: "productoDetails",
        },
      },
      { $unwind: { path: "$productoDetails", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            categoria: { $ifNull: ["$productoDetails.categoria", "Otro"] },
          },
          cantidad: { $sum: "$items.cantidad" },
          ultimaVentaAt: { $max: "$createdAt" },
        },
      },
      {
        $sort: {
          "_id.categoria": 1,
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ];

    const productSalesPipeline = [
      { $match: { estado: "Activa", createdAt: { $gte: twelveMonthsAgo } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "productos",
          localField: "items.productId",
          foreignField: "_id",
          as: "productoDetails",
        },
      },
      { $unwind: { path: "$productoDetails", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            categoria: { $ifNull: ["$productoDetails.categoria", "Otro"] },
            productId: { $ifNull: ["$productoDetails._id", "$items.productId"] },
            nombre: { $ifNull: ["$productoDetails.nombre", "$items.producto"] },
            marca: { $ifNull: ["$productoDetails.marca", "Sin marca"] },
          },
          cantidad: { $sum: "$items.cantidad" },
          ultimaVentaAt: { $max: "$createdAt" },
          stockActual: { $max: { $ifNull: ["$productoDetails.stock", 0] } },
        },
      },
      {
        $sort: {
          "_id.categoria": 1,
          "_id.nombre": 1,
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ];

    const stockPipeline = [
      {
        $group: {
          _id: { $ifNull: ["$categoria", "Otro"] },
          stockActual: { $sum: "$stock" },
          totalProductos: { $sum: 1 },
        },
      },
    ];

    const [salesResult, stockResult, productSalesResult] = await Promise.all([
      Sale.aggregate(salesPipeline),
      Product.aggregate(stockPipeline),
      Sale.aggregate(productSalesPipeline),
    ]);

    const formattedSales = salesResult.map((row) => ({
      categoria: row._id.categoria,
      fecha: `${row._id.year}-${padMonthNumber(row._id.month)}`,
      cantidad: row.cantidad,
    }));

    const stockByCategory = new Map(
      stockResult.map((row) => [
        String(row._id || "Otro"),
        {
          stockActual: Number(row.stockActual || 0),
          totalProductos: Number(row.totalProductos || 0),
        },
      ])
    );

    const monthKeys = buildPredictiveMonthKeys(today, 12);
    const categoryRows = new Map();
    const productRows = new Map();

    salesResult.forEach((row) => {
      const categoryName = String(row?._id?.categoria || "Otro");
      const monthKey = `${row._id.year}-${padMonthNumber(row._id.month)}`;
      const current = categoryRows.get(categoryName) || {
        monthlySales: new Map(),
        lastSaleAt: null,
      };

      current.monthlySales.set(monthKey, Number(row.cantidad || 0));

      if (!current.lastSaleAt || new Date(row.ultimaVentaAt) > new Date(current.lastSaleAt)) {
        current.lastSaleAt = row.ultimaVentaAt;
      }

      categoryRows.set(categoryName, current);
    });

    productSalesResult.forEach((row) => {
      const categoryName = String(row?._id?.categoria || "Otro");
      const productId = row?._id?.productId ? String(row._id.productId) : String(row?._id?.nombre || "producto");
      const rowKey = `${categoryName}::${productId}`;
      const monthKey = `${row._id.year}-${padMonthNumber(row._id.month)}`;
      const current = productRows.get(rowKey) || {
        category: categoryName,
        productId,
        nombre: String(row?._id?.nombre || "Producto sin nombre"),
        marca: String(row?._id?.marca || "Sin marca"),
        stockActual: Number(row.stockActual || 0),
        lastSaleAt: null,
        monthlySales: new Map(),
      };

      current.monthlySales.set(monthKey, Number(row.cantidad || 0));
      current.stockActual = Number(row.stockActual || current.stockActual || 0);

      if (!current.lastSaleAt || new Date(row.ultimaVentaAt) > new Date(current.lastSaleAt)) {
        current.lastSaleAt = row.ultimaVentaAt;
      }

      productRows.set(rowKey, current);
    });

    const categorySummaries = {};
    Array.from(categoryRows.entries())
      .sort(([categoryA], [categoryB]) => categoryA.localeCompare(categoryB, "es"))
      .forEach(([categoryName, row]) => {
        const values = monthKeys.map((monthKey) => Number(row.monthlySales.get(monthKey) || 0));
        const stockInfo = stockByCategory.get(categoryName) || { stockActual: 0, totalProductos: 0 };

        categorySummaries[categoryName] = buildPredictiveCategorySummary({
          values,
          lastSaleAt: row.lastSaleAt,
          stockActual: stockInfo.stockActual,
          totalProducts: stockInfo.totalProductos,
          generatedAt: today,
        });
      });

    const productBreakdown = {};
    Array.from(productRows.values())
      .sort((left, right) => {
        const byCategory = left.category.localeCompare(right.category, "es");
        if (byCategory !== 0) return byCategory;
        return left.nombre.localeCompare(right.nombre, "es");
      })
      .forEach((row) => {
        const values = monthKeys.map((monthKey) => Number(row.monthlySales.get(monthKey) || 0));
        const summary = buildPredictiveProductSummary({
          productId: row.productId,
          nombre: row.nombre,
          marca: row.marca,
          values,
          lastSaleAt: row.lastSaleAt,
          stockActual: row.stockActual,
        });

        if (!productBreakdown[row.category]) {
          productBreakdown[row.category] = [];
        }

        productBreakdown[row.category].push(summary);
      });

    Object.keys(productBreakdown).forEach((categoryName) => {
      productBreakdown[categoryName].sort((left, right) => {
        if (right.projected3Months !== left.projected3Months) {
          return right.projected3Months - left.projected3Months;
        }
        return right.totalUnits - left.totalUnits;
      });
    });

    const alerts = buildPredictiveAlerts(categorySummaries, productBreakdown);

    const latestRecordedSaleAt = salesResult.reduce((latest, row) => {
      if (!row?.ultimaVentaAt) return latest;
      if (!latest || new Date(row.ultimaVentaAt) > new Date(latest)) {
        return row.ultimaVentaAt;
      }
      return latest;
    }, null);

    return res.json({
      meta: {
        generatedAt: today.toISOString(),
        model: "Regresion lineal simple",
        monthsWindow: 12,
        latestRecordedSaleAt: latestRecordedSaleAt ? new Date(latestRecordedSaleAt).toISOString() : null,
      },
      sales: formattedSales,
      categorySummaries,
      productBreakdown,
      alerts,
    });
  } catch(error) {
    console.error("Error en /sales/predictive:", error);
    return res.status(500).json({ errors: ["No se pudo generar la predicción."] });
  }
});

router.post("/sales", async (req, res) => {
  const cliente = sanitizeText(req.body.cliente);
  const metodoPago = sanitizeSalePaymentMethod(req.body.metodoPago);
  const pagoConRaw = parsePositiveNumber(req.body.pagoCon, NaN);
  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];

  if (rawItems.length === 0) {
    return res.status(400).json({ errors: ["Debes agregar al menos un producto."] });
  }

  const aggregatedByProduct = new Map();
  const errors = [];

  rawItems.forEach((item) => {
    const productId = sanitizeText(item?.productId);
    const cantidad = parsePositiveInteger(item?.cantidad, NaN);

    if (!isValidId(productId)) {
      errors.push("Uno o mas productos son invalidos.");
      return;
    }
    if (!Number.isFinite(cantidad)) {
      errors.push("Cantidad invalida en uno o mas productos.");
      return;
    }

    const previous = aggregatedByProduct.get(productId) || 0;
    aggregatedByProduct.set(productId, previous + cantidad);
  });

  if (aggregatedByProduct.size === 0 || errors.length) {
    return res.status(400).json({ errors: Array.from(new Set(errors)) });
  }

  const productIds = Array.from(aggregatedByProduct.keys());
  const products = await Product.find({ _id: { $in: productIds } });
  const productsById = new Map(products.map((product) => [String(product._id), product]));

  if (productsById.size !== productIds.length) {
    return res.status(404).json({ errors: ["Uno o mas productos no existen."] });
  }

  for (const [productId, cantidad] of aggregatedByProduct.entries()) {
    const product = productsById.get(productId);
    if (!product) continue;
    const stockActual = Number(product.stock || 0);
    if (stockActual < cantidad) {
      errors.push(`Stock insuficiente para ${product.nombre}. Disponible: ${stockActual}.`);
    }
  }

  if (errors.length) {
    return res.status(400).json({ errors: Array.from(new Set(errors)) });
  }

  const usuario =
    sanitizeText(req.admin.username) ||
    sanitizeText(req.admin.correo) ||
    "Admin";

  const saleItems = [];
  let subtotal = 0;

  for (const [productId, cantidad] of aggregatedByProduct.entries()) {
    const product = productsById.get(productId);
    const precioUnitario = Number(product.precio || 0);
    const itemSubtotal = precioUnitario * cantidad;
    subtotal += itemSubtotal;

    saleItems.push({
      productId: product._id,
      producto: product.nombre,
      cantidad,
      precioUnitario,
      subtotal: itemSubtotal,
    });
  }

  if (!metodoPago) {
    errors.push("Metodo de pago invalido.");
  }

  if (metodoPago === "Efectivo") {
    if (!Number.isFinite(pagoConRaw)) {
      errors.push("Pago con invalido para efectivo.");
    } else if (pagoConRaw < subtotal) {
      errors.push("El pago en efectivo debe ser igual o mayor al total.");
    }
  }

  if (errors.length) {
    return res.status(400).json({ errors: Array.from(new Set(errors)) });
  }

  const pagoCon = metodoPago === "Efectivo" ? pagoConRaw : 0;
  const cambio = metodoPago === "Efectivo" ? Math.max(pagoCon - subtotal, 0) : 0;

  for (const item of saleItems) {
    const product = productsById.get(String(item.productId));
    const stockAnterior = Number(product.stock || 0);
    const stockActual = stockAnterior - item.cantidad;

    product.stock = stockActual;
    await product.save();
    recordRecentOperation({ collection: "productos", type: "update" });

    await InventoryMovement.create({
      producto: product.nombre,
      accion: "Salida",
      cantidad: item.cantidad,
      usuario,
      stockAnterior,
      stockActual,
    });
    recordRecentOperation({ collection: "movimientos_inventario", type: "insert" });
  }

  const sale = await Sale.create({
    cliente,
    usuario,
    metodoPago,
    pagoCon,
    cambio,
    items: saleItems,
    subtotal,
    total: subtotal,
    estado: "Activa",
  });
  recordRecentOperation({ collection: "ventas", type: "insert" });

  return res.status(201).json({ sale: mapSale(sale.toObject()) });
});

router.post("/sales/:id/cancel", async (req, res) => {
  const saleId = sanitizeText(req.params.id);
  const motivoAnulacion = sanitizeText(req.body.motivo);

  if (!isValidId(saleId)) {
    return res.status(400).json({ errors: ["Venta invalida."] });
  }

  if (!motivoAnulacion) {
    return res.status(400).json({ errors: ["Debes indicar el motivo de anulacion."] });
  }

  const sale = await Sale.findById(saleId);
  if (!sale) {
    return res.status(404).json({ errors: ["Venta no encontrada."] });
  }

  if ((sale.estado || "Activa") === "Anulada") {
    return res.status(400).json({ errors: ["La venta ya fue anulada."] });
  }

  const saleItems = Array.isArray(sale.items) ? sale.items : [];
  if (!saleItems.length) {
    return res.status(400).json({ errors: ["La venta no tiene productos para revertir."] });
  }

  const productIds = saleItems
    .map((item) => String(item?.productId || ""))
    .filter((productId) => isValidId(productId));

  if (productIds.length !== saleItems.length) {
    return res.status(400).json({ errors: ["La venta contiene productos invalidos y no se puede anular."] });
  }

  const products = await Product.find({ _id: { $in: productIds } });
  const productsById = new Map(products.map((product) => [String(product._id), product]));
  if (productsById.size !== productIds.length) {
    return res.status(404).json({ errors: ["Uno o mas productos de la venta ya no existen."] });
  }

  const usuario =
    sanitizeText(req.admin.username) ||
    sanitizeText(req.admin.correo) ||
    "Admin";

  for (const item of saleItems) {
    const product = productsById.get(String(item.productId));
    if (!product) continue;

    const cantidad = Number(item.cantidad || 0);
    const stockAnterior = Number(product.stock || 0);
    const stockActual = stockAnterior + cantidad;

    product.stock = stockActual;
    await product.save();
    recordRecentOperation({ collection: "productos", type: "update" });

    await InventoryMovement.create({
      productId: product._id,
      producto: product.nombre,
      marca: product.marca || "",
      categoria: product.categoria || "",
      cantidadMedida:
        Number.isFinite(Number(product.cantidadMedida)) && Number(product.cantidadMedida) > 0
          ? Number(product.cantidadMedida)
          : undefined,
      unidadMedida: product.unidadMedida || "",
      accion: "Entrada",
      cantidad,
      usuario,
      stockAnterior,
      stockActual,
    });
    recordRecentOperation({ collection: "movimientos_inventario", type: "insert" });
  }

  sale.estado = "Anulada";
  sale.anuladaAt = new Date();
  sale.anuladaPor = usuario;
  sale.motivoAnulacion = motivoAnulacion;
  await sale.save();
  recordRecentOperation({ collection: "ventas", type: "update" });

  return res.json({ sale: mapSale(sale.toObject()) });
});

router.get("/promotions", async (_req, res) => {
  const promotions = await Promotion.find().sort({ createdAt: -1 }).lean();
  return res.json({ promotions: promotions.map(mapId) });
});

router.get("/home-highlights", async (_req, res) => {
  const [products, services, promotions] = await Promise.all([
    Product.find().sort({ destacadoInicio: -1, createdAt: -1 }).lean(),
    Service.find().sort({ destacadoInicio: -1, createdAt: -1 }).lean(),
    Promotion.find().sort({ destacadoInicio: -1, createdAt: -1 }).lean(),
  ]);

  return res.json({
    products: products.map(mapId),
    services: services.map(mapId),
    promotions: promotions.map(mapId),
  });
});

router.put("/home-highlights", async (req, res) => {
  const productIds = normalizeObjectIdList(req.body.productIds);
  const serviceIds = normalizeObjectIdList(req.body.serviceIds);
  const promotionIds = normalizeObjectIdList(req.body.promotionIds);

  await Promise.all([
    Product.updateMany({}, { $set: { destacadoInicio: false } }),
    Service.updateMany({}, { $set: { destacadoInicio: false } }),
    Promotion.updateMany({}, { $set: { destacadoInicio: false } }),
  ]);

  await Promise.all([
    productIds.length
      ? Product.updateMany({ _id: { $in: productIds } }, { $set: { destacadoInicio: true } })
      : Promise.resolve(),
    serviceIds.length
      ? Service.updateMany({ _id: { $in: serviceIds } }, { $set: { destacadoInicio: true } })
      : Promise.resolve(),
    promotionIds.length
      ? Promotion.updateMany({ _id: { $in: promotionIds } }, { $set: { destacadoInicio: true } })
      : Promise.resolve(),
  ]);

  return res.json({
    message: "Destacados de inicio actualizados.",
    summary: {
      products: productIds.length,
      services: serviceIds.length,
      promotions: promotionIds.length,
    },
  });
});

router.post("/promotions", async (req, res) => {
  const titulo = sanitizeText(req.body.titulo);
  const descripcion = sanitizeText(req.body.descripcion);
  const descuento = sanitizeText(req.body.descuento);
  const estado = sanitizeState(req.body.estado);
  const destacadoInicio = parseBooleanFlag(req.body.destacadoInicio, false);

  const errors = [];
  if (!titulo) errors.push("Titulo es obligatorio.");
  if (!descuento) errors.push("Descuento es obligatorio.");
  if (errors.length) return res.status(400).json({ errors });

  const promotion = await Promotion.create({
    titulo,
    descripcion,
    descuento,
    estado,
    destacadoInicio,
  });

  return res.status(201).json({ promotion: mapId(promotion.toObject()) });
});

router.put("/promotions/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Promocion invalida."] });
  }

  const current = await Promotion.findById(id);
  if (!current) {
    return res.status(404).json({ errors: ["Promocion no encontrada."] });
  }

  const titulo = sanitizeText(req.body.titulo);
  const descripcion = sanitizeText(req.body.descripcion);
  const descuento = sanitizeText(req.body.descuento);
  const estado = sanitizeState(req.body.estado);
  const destacadoInicio = parseBooleanFlag(req.body.destacadoInicio, current.destacadoInicio);

  const errors = [];
  if (!titulo) errors.push("Titulo es obligatorio.");
  if (!descuento) errors.push("Descuento es obligatorio.");
  if (errors.length) return res.status(400).json({ errors });

  current.titulo = titulo;
  current.descripcion = descripcion;
  current.descuento = descuento;
  current.estado = estado;
  current.destacadoInicio = destacadoInicio;
  await current.save();

  return res.json({ promotion: mapId(current.toObject()) });
});

router.delete("/promotions/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Promocion invalida."] });
  }

  const deleted = await Promotion.findByIdAndDelete(id);
  if (!deleted) {
    return res.status(404).json({ errors: ["Promocion no encontrada."] });
  }

  return res.json({ message: "Promocion eliminada." });
});

module.exports = router;
