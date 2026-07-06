const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const AlexaAccessCode = require("../models/CodigoAlexa");
const Appointment = require("../models/Cita");
const Service = require("../models/Servicio");
const StaffMember = require("../models/MiembroPersonal");
const StylistAvailability = require("../models/DisponibilidadEstilista");
const User = require("../models/Usuario");
const { isBrevoConfigured, sendTransactionalEmail } = require("../utils/brevo");
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
  validateDateTime,
  validateNotes,
} = require("../utils/validadores");

const router = express.Router();

const CODE_EXPIRATION_MINUTES = Number(process.env.ALEXA_CODE_EXPIRATION_MINUTES || 10);
const SESSION_EXPIRATION_MINUTES = Number(process.env.ALEXA_SESSION_EXPIRATION_MINUTES || 45);
const MAX_CODE_ATTEMPTS = 5;

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + Math.max(1, Number(minutes) || 1) * 60 * 1000);
}

function normalizeIdentifier(value) {
  const raw = normalizeString(value).toLowerCase();
  if (!raw) return "";
  if (raw.includes("@")) return raw.replace(/\s+/g, "");
  return raw.replace(/\D/g, "");
}

function maskEmail(email = "") {
  const [name, domain] = String(email).split("@");
  if (!name || !domain) return "tu correo registrado";
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
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
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}

async function sendAlexaCodeEmail(user, code) {
  if (!isBrevoConfigured()) {
    throw new Error("El envío de correos no está configurado en el servidor.");
  }

  const name = [user.nombre, user.apellidoPaterno].filter(Boolean).join(" ") || "cliente";
  const minutes = CODE_EXPIRATION_MINUTES;

  return sendTransactionalEmail({
    to: { email: user.correo, name },
    subject: "Código para agendar por Alexa",
    textContent: `Tu código para agendar por Alexa es ${code}. Vence en ${minutes} minutos.`,
    htmlContent: `
      <div style="font-family:Arial,sans-serif;color:#24141f;line-height:1.5">
        <h2 style="color:#8a3b64">Estética Panamericana</h2>
        <p>Hola ${name},</p>
        <p>Tu código para continuar con Alexa es:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#8a3b64">${code}</p>
        <p>Este código vence en ${minutes} minutos. Si no lo solicitaste, puedes ignorar este correo.</p>
      </div>
    `,
  });
}

async function findClientByIdentifier(identifier) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return null;

  const query = normalized.includes("@")
    ? { correo: normalized }
    : { telefono: normalized };

  return User.findOne({
    ...query,
    role: "client",
    accountStatus: "active",
  });
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

async function resolveAppointmentService({ serviceId, servicio }, errors) {
  const normalizedServiceId = normalizeString(serviceId);
  const normalizedServiceName = normalizeString(servicio);

  if (normalizedServiceId) {
    if (!isValidId(normalizedServiceId)) {
      errors.push("Servicio inválido.");
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

  if (!normalizedServiceName) {
    errors.push("Servicio es obligatorio.");
    return null;
  }

  const service = await Service.findOne({ nombre: normalizedServiceName }).lean();
  return {
    serviceId: service?._id || null,
    nombre: service?.nombre || normalizedServiceName,
    precio: Number(service?.precio || 0),
    duracionMinutos: parseServiceDurationMinutes(service?.tiempo),
  };
}

async function findAvailableStylistForAppointment(fechaHora, durationMinutes) {
  const stylists = await listActiveStylists();
  if (!stylists.length) return null;

  const dateKey = toLocalDateKey(fechaHora);
  const timeKey = `${String(fechaHora.getHours()).padStart(2, "0")}:${String(fechaHora.getMinutes()).padStart(2, "0")}`;

  for (const stylist of stylists) {
    const availability = await getAvailabilityForStylist(stylist.id);
    const appointments = await getStylistAppointmentsInRange(stylist.id, fechaHora, fechaHora);
    const dayAvailability = buildAvailableSlotsForDate({ availability, dateKey, appointments, durationMinutes });
    if (dayAvailability.slots.includes(timeKey)) {
      return new mongoose.Types.ObjectId(stylist.id);
    }
  }

  return null;
}

async function ensureStylistAvailable(stylistId, fechaHora, durationMinutes) {
  if (!stylistId || !isValidId(stylistId)) {
    return { ok: false, errors: ["Selecciona un estilista válido."] };
  }

  const stylists = await listActiveStylists();
  const stylist = stylists.find((item) => String(item.id) === String(stylistId));
  if (!stylist) {
    return { ok: false, errors: ["El estilista seleccionado no está disponible."] };
  }

  const dateKey = toLocalDateKey(fechaHora);
  const timeKey = `${String(fechaHora.getHours()).padStart(2, "0")}:${String(fechaHora.getMinutes()).padStart(2, "0")}`;
  const availability = await getAvailabilityForStylist(stylistId);
  const appointments = await getStylistAppointmentsInRange(stylistId, fechaHora, fechaHora);
  const dayAvailability = buildAvailableSlotsForDate({ availability, dateKey, appointments, durationMinutes });

  if (!dayAvailability.slots.includes(timeKey)) {
    return {
      ok: false,
      errors: [dayAvailability.reason || "Ese horario no está disponible para el estilista seleccionado."],
    };
  }

  return { ok: true, stylist };
}

async function authenticateAlexaSession(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const tokenHash = hashValue(token);

  if (!tokenHash) {
    return res.status(401).json({ errors: ["Sesión de Alexa requerida."] });
  }

  const record = await AlexaAccessCode.findOne({
    sessionTokenHash: tokenHash,
    sessionExpiresAt: { $gt: new Date() },
    usedAt: { $ne: null },
  }).lean();

  if (!record) {
    return res.status(401).json({ errors: ["Sesión de Alexa vencida o inválida."] });
  }

  const user = await User.findOne({
    _id: record.userId,
    role: "client",
    accountStatus: "active",
  });

  if (!user) {
    return res.status(403).json({ errors: ["Cliente no disponible."] });
  }

  req.user = {
    id: String(user._id),
    correo: user.correo,
    role: user.role,
  };
  req.clientUser = user;
  return next();
}

router.post("/auth/start", async (req, res) => {
  try {
    const identifier = normalizeIdentifier(req.body?.identifier || req.body?.identificador || "");
    if (!identifier) {
      return res.status(400).json({ errors: ["Dime tu correo o teléfono registrado."] });
    }

    const isEmail = identifier.includes("@");
    if (!isEmail && identifier.length !== 10) {
      return res.status(400).json({ errors: ["El teléfono debe tener 10 dígitos."] });
    }

    const user = await findClientByIdentifier(identifier);
    if (!user) {
      return res.status(404).json({ errors: ["No encontré una cuenta de cliente activa con ese dato."] });
    }
    if (!user.correo) {
      return res.status(400).json({ errors: ["La cuenta no tiene correo para recibir el código."] });
    }

    const now = new Date();
    const code = generateCode();
    const record = await AlexaAccessCode.create({
      userId: user._id,
      identifier,
      codeHash: hashValue(code),
      expiresAt: addMinutes(now, CODE_EXPIRATION_MINUTES),
      attempts: 0,
    });

    await sendAlexaCodeEmail(user, code);

    return res.status(201).json({
      message: "Código enviado.",
      challengeId: String(record._id),
      expiresInMinutes: CODE_EXPIRATION_MINUTES,
      delivery: maskEmail(user.correo),
      userHint: {
        nombre: user.nombre || "",
      },
    });
  } catch (error) {
    console.error("Error en /api/alexa/auth/start:", error);
    return res.status(500).json({ errors: [error.message || "No fue posible enviar el código."] });
  }
});

router.post("/auth/verify", async (req, res) => {
  try {
    const challengeId = normalizeString(req.body?.challengeId || "");
    const code = normalizeString(req.body?.code || req.body?.codigo || "").replace(/\D/g, "");

    if (!isValidId(challengeId)) {
      return res.status(400).json({ errors: ["Solicitud de código inválida."] });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ errors: ["El código debe tener 6 dígitos."] });
    }

    const record = await AlexaAccessCode.findOne({
      _id: challengeId,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      return res.status(404).json({ errors: ["El código venció o no existe. Solicita uno nuevo."] });
    }
    if (record.attempts >= MAX_CODE_ATTEMPTS) {
      return res.status(429).json({ errors: ["Demasiados intentos. Solicita un código nuevo."] });
    }

    if (record.codeHash !== hashValue(code)) {
      record.attempts += 1;
      await record.save();
      return res.status(401).json({ errors: ["Código incorrecto."] });
    }

    const user = await User.findOne({
      _id: record.userId,
      role: "client",
      accountStatus: "active",
    });
    if (!user) {
      return res.status(403).json({ errors: ["Cliente no disponible."] });
    }

    const rawToken = generateSessionToken();
    const sessionExpiresAt = addMinutes(new Date(), SESSION_EXPIRATION_MINUTES);
    record.usedAt = new Date();
    record.sessionTokenHash = hashValue(rawToken);
    record.sessionExpiresAt = sessionExpiresAt;
    record.expiresAt = sessionExpiresAt;
    await record.save();

    return res.json({
      message: "Cliente validado.",
      token: rawToken,
      expiresInMinutes: SESSION_EXPIRATION_MINUTES,
      user: buildUserResponse(user),
    });
  } catch (error) {
    console.error("Error en /api/alexa/auth/verify:", error);
    return res.status(500).json({ errors: ["No fue posible verificar el código."] });
  }
});

router.use(authenticateAlexaSession);

router.get("/me", async (req, res) => {
  return res.json({ user: buildUserResponse(req.clientUser) });
});

router.get("/stylists", async (_req, res) => {
  const stylists = await listActiveStylists();
  return res.json({ stylists });
});

router.get("/stylists/:id/availability", async (req, res) => {
  const { id } = req.params;
  const errors = [];

  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Estilista inválido."] });
  }

  const desdeRaw = normalizeString(req.query.desde || "");
  const hastaRaw = normalizeString(req.query.hasta || desdeRaw);
  const desde = parseDateKey(desdeRaw);
  const hasta = parseDateKey(hastaRaw);

  if (!desde || !hasta) {
    return res.status(400).json({ errors: ["Rango de fechas inválido."] });
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

  const appointment = await Appointment.create({
    userId: req.user.id,
    stylistId: selectedStylistId,
    serviceId: serviceContext.serviceId,
    servicio: serviceContext.nombre,
    servicioPrecio: serviceContext.precio,
    duracionMinutos: serviceContext.duracionMinutos,
    fechaHora,
    notas: normalizeString(notas || "Agendada por Alexa"),
    estado: "pendiente",
  });

  return res.status(201).json({
    message: "Cita agendada correctamente.",
    appointment: buildAppointmentResponse(appointment),
  });
});

module.exports = router;
