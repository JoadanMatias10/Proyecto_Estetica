const express = require("express");
const mongoose = require("mongoose");
const Appointment = require("../models/Cita");
const ClientNotification = require("../models/NotificacionCliente");
const Service = require("../models/Servicio");
const StylistAvailability = require("../models/DisponibilidadEstilista");
const StaffMember = require("../models/MiembroPersonal");
const User = require("../models/Usuario");
const { verifyToken } = require("../utils/auth");
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

function buildClientNotificationResponse(notification) {
  return {
    id: String(notification._id),
    appointmentId: notification.appointmentId ? String(notification.appointmentId) : "",
    canal: notification.canal,
    anticipacion: notification.anticipacion,
    mensaje: notification.mensaje,
    estado: notification.estado,
    fechaObjetivo: notification.fechaObjetivo,
    createdAt: notification.createdAt,
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
  const settings = buildReminderSettingsResponse(user);
  const notification = await ClientNotification.create({
    userId: req.user.id,
    appointmentId,
    canal: settings.canal,
    anticipacion: settings.anticipacion,
    mensaje: messageText,
    fechaObjetivo: appointment.fechaHora || null,
  });

  return res.status(201).json({
    message: "Notificacion preparada.",
    notification: buildClientNotificationResponse(notification),
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
