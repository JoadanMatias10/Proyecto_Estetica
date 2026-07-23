const express = require("express");
const mongoose = require("mongoose");
const Appointment = require("../models/Cita");
const ClientNotification = require("../models/NotificacionCliente");
const ClientPayment = require("../models/PagoCliente");
const Product = require("../models/Producto");
const Service = require("../models/Servicio");
const StylistAvailability = require("../models/DisponibilidadEstilista");
const StaffMember = require("../models/MiembroPersonal");
const User = require("../models/Usuario");
const cloudinary = require("../config/cloudinary");
const { paymentProofUpload } = require("../middleware/multer");
const { verifyToken } = require("../utils/auth");
const {
  buildClientNotificationResponse,
  deliverClientAppointmentNotification,
  triggerDueAppointmentReminderScan,
} = require("../utils/clientNotifications");
const { parseServiceDurationMinutes } = require("../utils/serviceDuration");
const {
  buildAvailableSlotsForDate,
  buildDateRange,
  getDefaultAvailability,
  getEndOfDay,
  getStartOfDay,
  mapAvailability,
  parseDateKey,
  toLocalDateKey,
} = require("../utils/stylistAvailability");
const {
  normalizeString,
  validateName,
  validateEmail,
  validatePhone,
  validateDateTime,
  validateNotes,
} = require("../utils/validadores");

const router = express.Router();
const CLIENT_EDITABLE_APPOINTMENT_STATUS = new Set(["pendiente", "programada", "confirmada"]);
const REMINDER_OPTIONS = new Set(["24 horas antes", "12 horas antes", "2 horas antes"]);
const NOTIFICATION_CHANNELS = new Set(["Email", "WhatsApp", "Notificacion interna"]);
const DEFAULT_REMINDER_SETTINGS = {
  anticipacion: "24 horas antes",
  canal: "Email",
};
const DEFAULT_NOTIFICATION_PREFERENCES = {
  appointmentReminders: true,
  promotions: true,
  appointmentChanges: true,
};
const PAYMENT_TYPES = new Set(["Producto", "Servicio"]);
const PAYMENT_METHODS = new Set(["Tarjeta", "Transferencia", "Pago en sucursal"]);
const DEMO_BANK_CLABE = "000000000000000000";
const CLOUDINARY_UNAVAILABLE_MESSAGE =
  "La carga de comprobantes no esta disponible. Configura Cloudinary en el servidor.";

function buildBankTransferConfig() {
  const configuredClabe = String(process.env.BANK_TRANSFER_CLABE || "").replace(/\D/g, "");
  const hasRealClabe = /^\d{18}$/.test(configuredClabe) && !/^0+$/.test(configuredClabe);

  return {
    bank: normalizeString(process.env.BANK_TRANSFER_BANK || "BanCoppel"),
    beneficiary: normalizeString(process.env.BANK_TRANSFER_BENEFICIARY || "Estetica Panamericana"),
    clabe: hasRealClabe ? configuredClabe : DEMO_BANK_CLABE,
    account: normalizeString(process.env.BANK_TRANSFER_ACCOUNT || ""),
    isDemo: !hasRealClabe,
  };
}

function requirePaymentProofUploadSupport(req, res, next) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  const isMultipartRequest = contentType.includes("multipart/form-data");

  if (!isMultipartRequest || cloudinary.isConfigured) {
    return next();
  }

  return res.status(503).json({ errors: [CLOUDINARY_UNAVAILABLE_MESSAGE] });
}

async function cleanupUploadedPaymentProof(uploadedProof) {
  const publicId = normalizeString(uploadedProof?.filename || uploadedProof?.public_id);
  if (!publicId || !cloudinary.isConfigured) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: "image",
    });
  } catch (error) {
    console.error("No fue posible eliminar el comprobante de transferencia:", error);
  }
}

function parsePaymentDetail(value, errors) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch (_error) {
    errors.push("El detalle del pago no tiene un formato valido.");
  }

  return [];
}

function buildUserResponse(user) {
  return {
    id: String(user._id),
    nombre: user.nombre || "",
    apellidoPaterno: user.apellidoPaterno || "",
    apellidoMaterno: user.apellidoMaterno || "",
    telefono: user.telefono || "",
    correo: user.correo || "",
    role: user.role || "client",
  };
}

function buildAppointmentResponse(appointment) {
  return {
    id: String(appointment._id),
    stylistId: appointment.stylistId ? String(appointment.stylistId) : "",
    serviceId: appointment.serviceId ? String(appointment.serviceId) : "",
    servicio: appointment.servicio,
    servicioPrecio: Number(appointment.servicioPrecio || 0),
    duracionMinutos: Number(appointment.duracionMinutos || 30),
    fechaHora: appointment.fechaHora,
    notas: appointment.notas || "",
    estado: appointment.estado === "programada" ? "pendiente" : appointment.estado || "pendiente",
    paymentId: appointment.paymentId ? String(appointment.paymentId) : "",
    estatusPago: appointment.estatusPago || "Sin pago",
    pagadoAt: appointment.pagadoAt || null,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}

function buildReminderSettingsResponse(user) {
  return {
    ...DEFAULT_REMINDER_SETTINGS,
    ...(user?.reminderSettings || {}),
  };
}

function buildNotificationPreferencesResponse(user) {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(user?.notificationPreferences || {}),
  };
}

function validateClientService(value, errors) {
  const normalized = normalizeString(value);
  if (!normalized) {
    errors.push("Servicio es obligatorio.");
    return false;
  }
  if (normalized.length < 2 || normalized.length > 120) {
    errors.push("Servicio debe tener entre 2 y 120 caracteres.");
    return false;
  }
  return true;
}

async function resolveAppointmentService({ serviceId, servicio }, errors) {
  const normalizedServiceId = normalizeString(serviceId);
  const normalizedServiceName = normalizeString(servicio);

  if (normalizedServiceId) {
    if (!isValidId(normalizedServiceId)) {
      errors.push("Servicio invalido.");
      return null;
    }

    const service = await Service.findById(normalizedServiceId).lean();
    if (!service) {
      errors.push("Servicio no encontrado.");
      return null;
    }

    return {
      serviceId: service._id,
      nombre: service.nombre,
      precio: Number(service.precio || 0),
      duracionMinutos: parseServiceDurationMinutes(service.tiempo),
    };
  }

  validateClientService(normalizedServiceName, errors);
  if (errors.length) return null;

  const service = await Service.findOne({ nombre: normalizedServiceName }).lean();
  return {
    serviceId: service?._id || null,
    nombre: service?.nombre || normalizedServiceName,
    precio: Number(service?.precio || 0),
    duracionMinutos: parseServiceDurationMinutes(service?.tiempo),
  };
}

function canClientModifyAppointment(appointment) {
  return CLIENT_EDITABLE_APPOINTMENT_STATUS.has(String(appointment?.estado || "pendiente").toLowerCase());
}

function normalizeReminderSettingsPayload(payload, errors) {
  const anticipacion = normalizeString(payload?.anticipacion || DEFAULT_REMINDER_SETTINGS.anticipacion);
  const canal = normalizeString(payload?.canal || DEFAULT_REMINDER_SETTINGS.canal);

  if (!REMINDER_OPTIONS.has(anticipacion)) {
    errors.push("Anticipacion de recordatorio invalida.");
  }
  if (!NOTIFICATION_CHANNELS.has(canal)) {
    errors.push("Canal de notificacion invalido.");
  }

  return { anticipacion, canal };
}

function normalizeNotificationPreferencesPayload(payload) {
  return {
    appointmentReminders: Boolean(payload?.appointmentReminders),
    promotions: Boolean(payload?.promotions),
    appointmentChanges: Boolean(payload?.appointmentChanges),
  };
}

function buildClientFullName(user) {
  return [user?.nombre, user?.apellidoPaterno, user?.apellidoMaterno]
    .map((value) => normalizeString(value))
    .filter(Boolean)
    .join(" ");
}

function normalizeClientPaymentMethod(value) {
  const method = normalizeString(value || "Transferencia");
  if (PAYMENT_METHODS.has(method)) return method;
  return "";
}

function getClientPaymentStatus(method) {
  if (method === "Transferencia" || method === "Pago en sucursal") return "Pendiente";
  return "Pagado";
}

function getPaymentItemId(item) {
  return normalizeString(item?.itemId || item?.productId || item?.serviceId || item?.id || "");
}

function getPaymentItemQuantity(item) {
  const quantity = Math.floor(Number(item?.cantidad || item?.quantity || 1));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function buildPaymentConcept(type, items) {
  if (items.length === 1) return items[0].nombre;
  const totalItems = items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
  return type === "Producto"
    ? `Carrito (${totalItems} ${totalItems === 1 ? "producto" : "productos"})`
    : `${items.length} servicios`;
}

function buildClientPaymentResponse(payment) {
  const source = typeof payment?.toObject === "function" ? payment.toObject() : payment;
  const createdAt = source.createdAt || new Date();
  return {
    id: String(source._id),
    tipo: source.tipo,
    concepto: source.concepto,
    total: Number(source.total || 0),
    metodo: source.metodo,
    fecha: new Date(createdAt).toISOString().slice(0, 10),
    estatus: source.estatus,
    appointmentId: source.appointmentId ? String(source.appointmentId) : "",
    saleId: source.saleId ? String(source.saleId) : "",
    detalle: Array.isArray(source.detalle) ? source.detalle : [],
    cliente: source.cliente || {},
    referencia: source.referencia || "",
    comprobanteUrl: source.comprobanteUrl || "",
    notas: source.notas || "",
    notasAdmin: source.notasAdmin || "",
    revisadoAt: source.revisadoAt || null,
    revisadoPor: source.revisadoPor || "",
    createdAt,
  };
}

function getAppointmentPaymentStatus(paymentStatus) {
  return ["Pagado", "Confirmado"].includes(paymentStatus) ? "Pagado" : "Pendiente";
}

function canAppointmentReceivePayment(appointment) {
  const appointmentStatus = String(appointment?.estado || "").toLowerCase();
  const paymentStatus = appointment?.estatusPago || "Sin pago";
  return (
    ["pendiente", "programada", "confirmada"].includes(appointmentStatus) &&
    ["Sin pago", "Rechazado"].includes(paymentStatus)
  );
}

async function normalizeClientPaymentItems(type, rawItems, errors) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (!items.length) {
    errors.push("Agrega al menos un producto o servicio al pago.");
    return [];
  }

  const itemIds = items.map(getPaymentItemId);
  if (itemIds.some((id) => !id || !isValidId(id))) {
    errors.push(type === "Producto" ? "Producto invalido en el pago." : "Servicio invalido en el pago.");
    return [];
  }

  const objectIds = itemIds.map((id) => new mongoose.Types.ObjectId(id));
  const Model = type === "Producto" ? Product : Service;
  const records = await Model.find({ _id: { $in: objectIds } })
    .select(type === "Producto" ? "nombre precio stock" : "nombre precio")
    .lean();
  const recordsById = new Map(records.map((record) => [String(record._id), record]));

  const normalizedItems = [];
  for (const rawItem of items) {
    const id = getPaymentItemId(rawItem);
    const record = recordsById.get(id);
    if (!record) {
      errors.push(type === "Producto" ? "Producto no encontrado." : "Servicio no encontrado.");
      continue;
    }

    const quantity = type === "Producto" ? getPaymentItemQuantity(rawItem) : 1;
    if (!quantity) {
      errors.push("Cantidad invalida en el pago.");
      continue;
    }

    if (type === "Producto" && Number(record.stock || 0) < quantity) {
      errors.push(`No hay stock suficiente para ${record.nombre}.`);
      continue;
    }

    const price = Number(record.precio || 0);
    const subtotal = price * quantity;
    normalizedItems.push({
      itemId: record._id,
      nombre: record.nombre,
      cantidad: quantity,
      precio: price,
      subtotal,
    });
  }

  return normalizedItems;
}

async function getAppointmentDurationMinutes(appointment) {
  const storedDuration = Number(appointment?.duracionMinutos || 0);
  if (Number.isFinite(storedDuration) && storedDuration >= 15) return storedDuration;

  const serviceId = appointment?.serviceId ? String(appointment.serviceId) : "";
  if (serviceId && isValidId(serviceId)) {
    const service = await Service.findById(serviceId).select("tiempo").lean();
    return parseServiceDurationMinutes(service?.tiempo);
  }

  const serviceName = normalizeString(appointment?.servicio || "");
  if (serviceName) {
    const service = await Service.findOne({ nombre: serviceName }).select("tiempo").lean();
    return parseServiceDurationMinutes(service?.tiempo);
  }

  return parseServiceDurationMinutes("");
}

function validateOptionalName(value, field, errors) {
  const normalized = normalizeString(value);
  if (!normalized) return true;
  return validateName(normalized, field, errors);
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getDayRange(date) {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999),
  };
}

async function listActiveStylists() {
  const staff = await StaffMember.find({
    rol: "Estilista",
    estado: "Activo",
    userId: { $ne: null },
  })
    .select("userId nombre email telefono")
    .lean();

  const staffUserIds = staff
    .map((item) => String(item.userId || ""))
    .filter((id) => isValidId(id));

  if (!staffUserIds.length) return [];

  const users = await User.find({
    _id: { $in: staffUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
    role: "stylist",
    accountStatus: "active",
  })
    .select("_id nombre correo")
    .lean();

  const usersById = new Map(users.map((user) => [String(user._id), user]));

  return staff
    .map((member) => {
      const userId = String(member.userId || "");
      const user = usersById.get(userId);
      if (!user) return null;
      return {
        id: userId,
        staffId: String(member._id),
        nombre: member.nombre || user.nombre || "Estilista",
        email: member.email || user.correo || "",
        telefono: member.telefono || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

async function getAvailabilityForStylist(stylistId) {
  const record = await StylistAvailability.findOne({ stylistId }).lean();
  return record || getDefaultAvailability(stylistId);
}

async function getStylistAppointmentsInRange(stylistId, fromDate, toDate, excludeAppointmentId = "") {
  const query = {
    stylistId: new mongoose.Types.ObjectId(stylistId),
    fechaHora: { $gte: getStartOfDay(fromDate), $lte: getEndOfDay(toDate) },
    estado: { $ne: "cancelada" },
  };
  if (excludeAppointmentId && isValidId(excludeAppointmentId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeAppointmentId) };
  }
  return Appointment.find(query).select("fechaHora estado duracionMinutos").lean();
}

async function buildAvailabilityDays({ stylistId, desde, hasta, durationMinutes = null }) {
  const availability = await getAvailabilityForStylist(stylistId);
  const appointments = await getStylistAppointmentsInRange(stylistId, desde, hasta);
  return buildDateRange(desde, hasta).map((dateKey) =>
    buildAvailableSlotsForDate({
      availability,
      dateKey,
      appointments,
      durationMinutes,
    })
  );
}

async function findAvailableStylistForAppointment(fechaHora, durationMinutes) {
  const stylists = await listActiveStylists();
  if (!stylists.length) return null;
  const { start, end } = getDayRange(fechaHora);
  const dateKey = toLocalDateKey(fechaHora);
  const timeKey = `${String(fechaHora.getHours()).padStart(2, "0")}:${String(fechaHora.getMinutes()).padStart(2, "0")}`;

  for (const stylist of stylists) {
    const availability = await getAvailabilityForStylist(stylist.id);
    const appointments = await getStylistAppointmentsInRange(stylist.id, start, end);
    const dayAvailability = buildAvailableSlotsForDate({ availability, dateKey, appointments, durationMinutes });
    if (dayAvailability.slots.includes(timeKey)) {
      return new mongoose.Types.ObjectId(stylist.id);
    }
  }

  return null;
}

async function ensureStylistAvailable(stylistId, fechaHora, durationMinutes, excludeAppointmentId = "") {
  if (!stylistId || !isValidId(stylistId)) {
    return { ok: false, errors: ["Selecciona un estilista valido."] };
  }

  const stylists = await listActiveStylists();
  const stylist = stylists.find((item) => String(item.id) === String(stylistId));
  if (!stylist) {
    return { ok: false, errors: ["El estilista seleccionado no esta disponible."] };
  }

  const dateKey = toLocalDateKey(fechaHora);
  const timeKey = `${String(fechaHora.getHours()).padStart(2, "0")}:${String(fechaHora.getMinutes()).padStart(2, "0")}`;
  const availability = await getAvailabilityForStylist(stylistId);
  const appointments = await getStylistAppointmentsInRange(stylistId, fechaHora, fechaHora, excludeAppointmentId);
  const dayAvailability = buildAvailableSlotsForDate({ availability, dateKey, appointments, durationMinutes });

  if (!dayAvailability.slots.includes(timeKey)) {
    return {
      ok: false,
      errors: [dayAvailability.reason || "Ese horario no esta disponible para el estilista seleccionado."],
    };
  }

  return { ok: true, stylist };
}

router.use((req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ errors: ["No autorizado."] });
  }
  if (payload.role !== "client") {
    return res.status(403).json({ errors: ["Acceso denegado para este rol."] });
  }
  req.user = payload;
  return next();
});

router.get("/me", async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ errors: ["Cliente no encontrado."] });
  }
  return res.json({ user: buildUserResponse(user) });
});

router.get("/stylists", async (_req, res) => {
  const stylists = await listActiveStylists();
  return res.json({ stylists });
});

router.get("/stylists/:id/availability", async (req, res) => {
  const { id } = req.params;
  const errors = [];
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Estilista invalido."] });
  }

  const desdeRaw = normalizeString(req.query.desde || "");
  const hastaRaw = normalizeString(req.query.hasta || desdeRaw);
  const desde = parseDateKey(desdeRaw);
  const hasta = parseDateKey(hastaRaw);

  if (!desde || !hasta) {
    return res.status(400).json({ errors: ["Rango de fechas invalido."] });
  }
  if (desde > hasta) {
    return res.status(400).json({ errors: ["La fecha inicio no puede ser mayor que la fecha fin."] });
  }

  const stylist = (await listActiveStylists()).find((item) => item.id === String(id));
  if (!stylist) {
    return res.status(404).json({ errors: ["Estilista no encontrado."] });
  }

  let durationMinutes = null;
  const serviceId = normalizeString(req.query.serviceId || "");
  if (serviceId) {
    const serviceContext = await resolveAppointmentService({ serviceId }, errors);
    if (errors.length) {
      return res.status(400).json({ errors });
    }
    durationMinutes = serviceContext?.duracionMinutos || null;
  }

  const availability = await getAvailabilityForStylist(id);
  const days = await buildAvailabilityDays({ stylistId: id, desde, hasta, durationMinutes });
  return res.json({
    stylist,
    availability: mapAvailability(availability, id),
    days,
  });
});

router.post("/profile/:id", async (req, res) => {
  const errors = [];
  const { id } = req.params;
  if (id !== req.user.id) {
    return res.status(403).json({ errors: ["Acceso denegado."] });
  }
  const { nombre, apellidoPaterno, apellidoMaterno, telefono, correo } = req.body;

  validateName(nombre, "Nombre", errors);
  validateOptionalName(apellidoPaterno, "Apellido paterno", errors);
  validateOptionalName(apellidoMaterno, "Apellido materno", errors);
  validatePhone(telefono, errors);
  validateEmail(correo, errors);

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  const normalizedEmail = normalizeString(correo).toLowerCase();
  const normalizedPhone = normalizeString(telefono);

  const existing = await User.findOne({
    _id: { $ne: id },
    $or: [{ correo: normalizedEmail }, { telefono: normalizedPhone }],
  });

  if (existing) {
    return res.status(409).json({ errors: ["El correo o teléfono ya están en uso."] });
  }

  const user = await User.findByIdAndUpdate(
    id,
    {
      nombre: normalizeString(nombre),
      apellidoPaterno: normalizeString(apellidoPaterno),
      apellidoMaterno: normalizeString(apellidoMaterno),
      telefono: normalizedPhone,
      correo: normalizedEmail,
    },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({ errors: ["Cliente no encontrado."] });
  }

  return res.json({
    message: "Perfil actualizado correctamente.",
    user: buildUserResponse(user),
  });
});

router.get("/notification-settings", async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) {
    return res.status(404).json({ errors: ["Cliente no encontrado."] });
  }

  return res.json({
    reminderSettings: buildReminderSettingsResponse(user),
    notificationPreferences: buildNotificationPreferencesResponse(user),
  });
});

router.put("/reminder-settings", async (req, res) => {
  const errors = [];
  const reminderSettings = normalizeReminderSettingsPayload(req.body, errors);
  if (errors.length) {
    return res.status(400).json({ errors });
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { reminderSettings },
    { new: true }
  );
  if (!user) {
    return res.status(404).json({ errors: ["Cliente no encontrado."] });
  }

  void triggerDueAppointmentReminderScan();

  return res.json({
    message: "Recordatorio guardado.",
    reminderSettings: buildReminderSettingsResponse(user),
  });
});

router.put("/notification-preferences", async (req, res) => {
  const notificationPreferences = normalizeNotificationPreferencesPayload(req.body);
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { notificationPreferences },
    { new: true }
  );
  if (!user) {
    return res.status(404).json({ errors: ["Cliente no encontrado."] });
  }

  return res.json({
    message: "Preferencias guardadas.",
    notificationPreferences: buildNotificationPreferencesResponse(user),
  });
});

router.get("/notifications", async (req, res) => {
  const notifications = await ClientNotification.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return res.json({ notifications: notifications.map(buildClientNotificationResponse) });
});

router.post("/notifications/prepare", async (req, res) => {
  const errors = [];
  const appointmentId = normalizeString(req.body.appointmentId || "");
  const messageText = normalizeString(req.body.messageText || "");

  if (!appointmentId || !isValidId(appointmentId)) {
    errors.push("Selecciona una cita valida.");
  }
  if (messageText.length < 5 || messageText.length > 500) {
    errors.push("El mensaje debe tener entre 5 y 500 caracteres.");
  }
  if (errors.length) {
    return res.status(400).json({ errors });
  }

  const appointment = await Appointment.findOne({ _id: appointmentId, userId: req.user.id }).lean();
  if (!appointment) {
    return res.status(404).json({ errors: ["Cita no encontrada."] });
  }
  if (!canClientModifyAppointment(appointment)) {
    return res.status(400).json({ errors: ["Esta cita ya no admite notificaciones."] });
  }

  const user = await User.findById(req.user.id).lean();
  if (!user) {
    return res.status(404).json({ errors: ["Cliente no encontrado."] });
  }

  const preferences = buildNotificationPreferencesResponse(user);
  if (!preferences.appointmentReminders) {
    return res.status(400).json({ errors: ["Activa los avisos de cita en tus preferencias de notificacion."] });
  }

  const result = await deliverClientAppointmentNotification({
    user,
    appointment,
    settings: buildReminderSettingsResponse(user),
    messageText,
    origen: "manual",
  });

  const payload = {
    message: result.message,
    notification: buildClientNotificationResponse(result.notification),
  };

  if (!result.ok) {
    return res.status(result.status).json({ errors: [result.message], ...payload });
  }

  return res.status(result.status).json(payload);
});

router.get("/payments", async (req, res) => {
  const payments = await ClientPayment.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return res.json({ payments: payments.map(buildClientPaymentResponse) });
});

router.get("/payment-config", (_req, res) => {
  const bankTransfer = buildBankTransferConfig();
  return res.json({
    bankTransfer: {
      ...bankTransfer,
      message: bankTransfer.isDemo
        ? "Datos de demostracion. No realices transferencias a esta CLABE."
        : "Realiza la transferencia y adjunta el comprobante para que el administrador la confirme.",
    },
  });
});

router.post(
  "/payments",
  requirePaymentProofUploadSupport,
  paymentProofUpload.single("comprobante"),
  async (req, res) => {
  const uploadedProof = req.file;
  const errors = [];
  const type = normalizeString(req.body.tipo || "Producto");
  const method = normalizeClientPaymentMethod(req.body.metodo || req.body.metodoPago);
  const appointmentId = normalizeString(req.body.appointmentId || "");
  const reference = normalizeString(req.body.referencia || "").slice(0, 80);
  const proofUrl = normalizeString(uploadedProof?.path || "");

  if (!PAYMENT_TYPES.has(type)) {
    errors.push("Tipo de pago invalido.");
  }
  if (!method) {
    errors.push("Metodo de pago invalido.");
  }
  if (method === "Transferencia") {
    if (reference.length < 4) {
      errors.push("Escribe la referencia de la transferencia.");
    }
    if (!proofUrl) {
      errors.push("Adjunta una imagen del comprobante de transferencia.");
    }
  } else if (uploadedProof) {
    errors.push("El comprobante solo se utiliza para pagos por transferencia.");
  }

  const user = await User.findById(req.user.id).lean();
  if (!user) {
    await cleanupUploadedPaymentProof(uploadedProof);
    return res.status(404).json({ errors: ["Cliente no encontrado."] });
  }

  const rawItems = parsePaymentDetail(req.body.detalle, errors);
  const items = errors.length ? [] : await normalizeClientPaymentItems(type, rawItems, errors);
  let total = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  let appointment = null;

  if (type === "Servicio") {
    if (!appointmentId || !isValidId(appointmentId)) {
      errors.push("Selecciona una cita valida para pagar el servicio.");
    } else {
      appointment = await Appointment.findOne({
        _id: appointmentId,
        userId: req.user.id,
      }).lean();

      if (!appointment) {
        errors.push("La cita seleccionada no existe.");
      } else if (!canAppointmentReceivePayment(appointment)) {
        errors.push("La cita ya tiene un pago activo o no se encuentra disponible para pago.");
      } else {
        const selectedServiceId = items[0]?.itemId ? String(items[0].itemId) : "";
        const appointmentServiceId = appointment.serviceId ? String(appointment.serviceId) : "";
        const sameService = appointmentServiceId
          ? selectedServiceId === appointmentServiceId
          : normalizeString(items[0]?.nombre).toLowerCase() ===
            normalizeString(appointment.servicio).toLowerCase();

        if (!sameService) {
          errors.push("El servicio del pago no coincide con el servicio reservado en la cita.");
        } else {
          const reservedPrice = Number(appointment.servicioPrecio);
          if (Number.isFinite(reservedPrice) && reservedPrice > 0) {
            items[0].precio = reservedPrice;
            items[0].subtotal = reservedPrice;
            total = reservedPrice;
          }
        }
      }
    }
  }

  if (total <= 0) {
    errors.push("El total del pago debe ser mayor a cero.");
  }
  if (errors.length) {
    await cleanupUploadedPaymentProof(uploadedProof);
    return res.status(400).json({ errors });
  }

  let payment;
  try {
    payment = await ClientPayment.create({
      userId: req.user.id,
      tipo: type,
      appointmentId: appointment?._id || null,
      concepto: buildPaymentConcept(type, items),
      total,
      metodo: method,
      estatus: getClientPaymentStatus(method),
      detalle: items,
      cliente: {
        nombre: buildClientFullName(user),
        telefono: user.telefono || "",
        correo: user.correo || "",
      },
      referencia: reference,
      comprobanteUrl: proofUrl,
      comprobantePublicId: normalizeString(uploadedProof?.filename || ""),
      comprobanteNombre: normalizeString(uploadedProof?.originalname || ""),
      notas: normalizeString(req.body.notas || "").slice(0, 300),
    });

    if (type === "Servicio") {
      const appointmentPaymentStatus = getAppointmentPaymentStatus(payment.estatus);
      const linkedAppointment = await Appointment.findOneAndUpdate(
        {
          _id: appointment._id,
          userId: req.user.id,
          estado: { $in: ["pendiente", "programada", "confirmada"] },
          $or: [
            { estatusPago: { $exists: false } },
            { estatusPago: { $in: ["Sin pago", "Rechazado"] } },
          ],
        },
        {
          $set: {
            paymentId: payment._id,
            estatusPago: appointmentPaymentStatus,
            pagadoAt: appointmentPaymentStatus === "Pagado" ? new Date() : null,
          },
        },
        { new: true }
      );

      if (!linkedAppointment) {
        await ClientPayment.findByIdAndDelete(payment._id);
        await cleanupUploadedPaymentProof(uploadedProof);
        return res.status(409).json({
          errors: ["La cita ya fue ligada a otro pago. Actualiza la pagina e intenta nuevamente."],
        });
      }
    }
  } catch (error) {
    if (payment?._id) {
      await ClientPayment.findByIdAndDelete(payment._id).catch(() => null);
    }
    await cleanupUploadedPaymentProof(uploadedProof);
    throw error;
  }

  const isPending = payment.estatus === "Pendiente";
  return res.status(201).json({
    message: isPending
      ? "Pago registrado. Queda pendiente de confirmacion."
      : "Pago registrado correctamente.",
    payment: buildClientPaymentResponse(payment),
  });
});

router.get("/appointments", async (req, res) => {
  const appointments = await Appointment.find({ userId: req.user.id })
    .sort({ fechaHora: 1, createdAt: -1 })
    .lean();

  return res.json({ appointments: appointments.map(buildAppointmentResponse) });
});

router.post("/appointments", async (req, res) => {
  const errors = [];
  const { serviceId, servicio, fecha, hora, notas, stylistId } = req.body;

  const fechaHora = validateDateTime(fecha, hora, errors);
  validateNotes(notas, errors);
  const serviceContext = await resolveAppointmentService({ serviceId, servicio }, errors);

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  let selectedStylistId = normalizeString(stylistId);
  if (selectedStylistId) {
    const availabilityResult = await ensureStylistAvailable(selectedStylistId, fechaHora, serviceContext.duracionMinutos);
    if (!availabilityResult.ok) {
      return res.status(400).json({ errors: availabilityResult.errors });
    }
  } else {
    const availableStylistId = await findAvailableStylistForAppointment(fechaHora, serviceContext.duracionMinutos);
    if (!availableStylistId) {
      return res.status(400).json({ errors: ["No hay estilistas disponibles en ese horario."] });
    }
    selectedStylistId = String(availableStylistId);
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ errors: ["Cliente no encontrado."] });
  }

  const appointment = await Appointment.create({
    userId: req.user.id,
    stylistId: selectedStylistId,
    serviceId: serviceContext.serviceId,
    servicio: serviceContext.nombre,
    servicioPrecio: serviceContext.precio,
    duracionMinutos: serviceContext.duracionMinutos,
    fechaHora,
    notas: normalizeString(notas),
    estado: "pendiente",
  });

  return res.status(201).json({
    message: "Cita agendada correctamente.",
    appointment: {
      ...buildAppointmentResponse(appointment),
    },
  });
});

router.post("/appointments/:id/reprogram", async (req, res) => {
  const errors = [];
  const { id } = req.params;
  const { fecha, hora, stylistId } = req.body;

  if (!isValidId(id)) {
    return res.status(404).json({ errors: ["Cita no encontrada."] });
  }

  const fechaHora = validateDateTime(fecha, hora, errors);
  if (errors.length) {
    return res.status(400).json({ errors });
  }

  const current = await Appointment.findOne({ _id: id, userId: req.user.id });
  if (!current) {
    return res.status(404).json({ errors: ["Cita no encontrada."] });
  }
  if (!canClientModifyAppointment(current)) {
    return res.status(400).json({ errors: ["Esta cita ya no se puede reprogramar."] });
  }

  const selectedStylistId = normalizeString(stylistId || current.stylistId);
  const durationMinutes = await getAppointmentDurationMinutes(current);
  const availabilityResult = await ensureStylistAvailable(selectedStylistId, fechaHora, durationMinutes, id);
  if (!availabilityResult.ok) {
    return res.status(400).json({ errors: availabilityResult.errors });
  }

  const appointment = await Appointment.findOneAndUpdate(
    { _id: id, userId: req.user.id },
    { fechaHora, stylistId: selectedStylistId, duracionMinutos: durationMinutes },
    { new: true }
  );

  if (!appointment) {
    return res.status(404).json({ errors: ["Cita no encontrada."] });
  }

  return res.json({
    message: "Cita reprogramada.",
    appointment: buildAppointmentResponse(appointment),
  });
});

router.post("/appointments/:id/cancel", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(404).json({ errors: ["Cita no encontrada."] });
  }

  const current = await Appointment.findOne({ _id: id, userId: req.user.id });
  if (!current) {
    return res.status(404).json({ errors: ["Cita no encontrada."] });
  }
  if (!canClientModifyAppointment(current)) {
    return res.status(400).json({ errors: ["Esta cita ya no se puede cancelar."] });
  }
  if (["Pendiente", "Pagado"].includes(current.estatusPago || "Sin pago")) {
    return res.status(400).json({
      errors: ["La cita tiene un pago activo. Contacta al negocio para solicitar la cancelacion."],
    });
  }

  const appointment = await Appointment.findOneAndUpdate(
    { _id: id, userId: req.user.id },
    { estado: "cancelada" },
    { new: true }
  );

  if (!appointment) {
    return res.status(404).json({ errors: ["Cita no encontrada."] });
  }

  return res.json({
    message: "Cita cancelada.",
    appointment: buildAppointmentResponse(appointment),
  });
});

module.exports = router;
