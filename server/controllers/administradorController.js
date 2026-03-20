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
const Promotion = require("../models/Promocion");
const Sale = require("../models/Venta");
const InventoryMovement = require("../models/MovimientoInventario");
const { verifyPassword } = require("../utils/contrasena");
const { createToken, verifyToken } = require("../utils/auth");
const { normalizeString } = require("../utils/validadores");
const {
  SERVICE_SEGMENTS,
  CAROUSEL_BG_OPTIONS,
} = require("../utils/datosCatalogoPredeterminado");

const router = express.Router();

const registrarAuthAdminRoutes = require("./administrador/authAdmin");
const registrarRespaldosAdminRoutes = require("./administrador/respaldosAdmin");
const registrarInventarioAdminRoutes = require("./administrador/inventarioAdmin");
const registrarStaffAdminRoutes = require("./administrador/staffAdmin");
const registrarCatalogoAdminRoutes = require("./administrador/catalogoAdmin");
const upload = require("../middleware/multer");

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
  promociones: "Promociones",
  ventas: "Ventas",
  movimientos_inventario: "Movimientos de inventario",
};

function mapId(record) {
  if (!record) return null;
  return {
    id: record._id.toString(),
    ...record,
    _id: undefined,
    __v: undefined,
  };
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
  if (!payload || payload.role !== "admin") {
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
  const allowed = ["Administrador", "Estilista", "Recepcionista"];
  return allowed.includes(normalized) ? normalized : "Estilista";
}

function estimateBase64Bytes(base64Content) {
  const normalized = String(base64Content || "").replace(/\s+/g, "");
  if (!normalized) return 0;
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function sanitizeSegment(value) {
  return SERVICE_SEGMENTS.includes(value) ? value : SERVICE_SEGMENTS[0];
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
  const adminUsers = await User.find({ role: "admin" })
    .select("nombre username correo telefono")
    .lean();

  for (const adminUser of adminUsers) {
    const email = sanitizeText(adminUser.correo).toLowerCase();
    const telefono = sanitizeText(adminUser.telefono);
    const nombre = sanitizeText(adminUser.nombre || adminUser.username || "Administrador");
    if (!email || !telefono || !nombre) continue;

    const byEmail = await findOneCaseInsensitive(StaffMember, "email", email);
    if (byEmail) {
      byEmail.nombre = nombre;
      byEmail.rol = "Administrador";
      byEmail.telefono = telefono;
      byEmail.estado = "Activo";
      await byEmail.save();
      continue;
    }

    const byPhone = await StaffMember.findOne({ telefono });
    if (byPhone) {
      byPhone.nombre = nombre;
      byPhone.rol = "Administrador";
      byPhone.email = email;
      byPhone.estado = "Activo";
      await byPhone.save();
      continue;
    }

    await StaffMember.create({
      nombre,
      rol: "Administrador",
      email,
      telefono,
      estado: "Activo",
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
  const cantidadDocumentos = await coleccion.countDocuments();

  let tamanoBytes = 0;
  try {
    const stats = await db.command({ collStats: nombreColeccion });
    tamanoBytes = Number(stats?.size || 0);
  } catch (_error) {
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

registrarAuthAdminRoutes(router, {
  normalizeString,
  getKey,
  getState,
  registerFailure,
  clearState,
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
  CAROUSEL_BG_OPTIONS,
  estimateBase64Bytes,
  ALLOWED_POLICY_DOCUMENT_TYPES,
  MAX_POLICY_DOCUMENT_BYTES,
  upload,
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
    const parsedDesde = new Date(desdeRaw);
    if (Number.isNaN(parsedDesde.getTime())) {
      return res.status(400).json({ errors: ["Fecha inicio invalida."] });
    }
    desde = getStartOfDay(parsedDesde);
  }

  if (hastaRaw) {
    const parsedHasta = new Date(hastaRaw);
    if (Number.isNaN(parsedHasta.getTime())) {
      return res.status(400).json({ errors: ["Fecha fin invalida."] });
    }
    hasta = getEndOfDay(parsedHasta);
  }

  if (desde && hasta && desde > hasta) {
    return res.status(400).json({ errors: ["La fecha inicio no puede ser mayor que la fecha fin."] });
  }

  const productFilter = buildFieldDateQuery("createdAt", desde, hasta);
  // Filtro de fecha para citas por fechaHora, construido con mismo patrón seguro.
  const appointmentFilter = buildFieldDateQuery("fechaHora", desde, hasta);

  const shouldIncludeProducts = tipo === "Todos" || tipo === "Venta";
  const shouldIncludeServices = tipo === "Todos" || tipo === "Servicio";

  const [products, appointments, services] = await Promise.all([
    shouldIncludeProducts
      ? Product.find(productFilter)
           .select("nombre precio createdAt")
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

  const productRows = products.map((product) => ({
    id: `prod-${product._id}`,
    fecha: product.createdAt,
    tipo: "Venta",
    detalle: product.nombre,
    monto: Number(product.precio || 0),
    usuario: "Catalogo",
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
    const parsedDesde = new Date(desdeRaw);
    if (Number.isNaN(parsedDesde.getTime())) {
      return res.status(400).json({ errors: ["Fecha inicio invalida."] });
    }
    desde = getStartOfDay(parsedDesde);
  }

  if (hastaRaw) {
    const parsedHasta = new Date(hastaRaw);
    if (Number.isNaN(parsedHasta.getTime())) {
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

  const total = mappedSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);

  return res.json({
    filters: {
      desde: desdeRaw,
      hasta: hastaRaw,
    },
    summary: {
      total,
      totalVentas: total,
      totalRegistros: mappedSales.length,
    },
    sales: mappedSales,
  });
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

    await InventoryMovement.create({
      producto: product.nombre,
      accion: "Salida",
      cantidad: item.cantidad,
      usuario,
      stockAnterior,
      stockActual,
    });
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
  });

  return res.status(201).json({ sale: mapSale(sale.toObject()) });
});

router.get("/promotions", async (_req, res) => {
  const promotions = await Promotion.find().sort({ createdAt: -1 }).lean();
  return res.json({ promotions: promotions.map(mapId) });
});

router.post("/promotions", async (req, res) => {
  const titulo = sanitizeText(req.body.titulo);
  const descripcion = sanitizeText(req.body.descripcion);
  const descuento = sanitizeText(req.body.descuento);
  const estado = sanitizeState(req.body.estado);

  const errors = [];
  if (!titulo) errors.push("Titulo es obligatorio.");
  if (!descuento) errors.push("Descuento es obligatorio.");
  if (errors.length) return res.status(400).json({ errors });

  const promotion = await Promotion.create({
    titulo,
    descripcion,
    descuento,
    estado,
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

  const errors = [];
  if (!titulo) errors.push("Titulo es obligatorio.");
  if (!descuento) errors.push("Descuento es obligatorio.");
  if (errors.length) return res.status(400).json({ errors });

  current.titulo = titulo;
  current.descripcion = descripcion;
  current.descuento = descuento;
  current.estado = estado;
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
