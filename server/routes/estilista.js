const express = require("express");
const mongoose = require("mongoose");
const Appointment = require("../models/Cita");
const StylistAvailability = require("../models/DisponibilidadEstilista");
const StaffMember = require("../models/MiembroPersonal");
const User = require("../models/Usuario");
const { verifyToken } = require("../utils/auth");
const { normalizeString } = require("../utils/validadores");
const {
  getDefaultAvailability,
  mapAvailability,
  normalizeBlockedPeriods,
  normalizeSlotMinutes,
  normalizeWeeklySchedule,
} = require("../utils/stylistAvailability");

const router = express.Router();

const APPOINTMENT_STATUS = new Set(["pendiente", "confirmada", "completada", "cancelada"]);

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeStatus(value) {
  const status = normalizeString(value).toLowerCase();
  if (status === "programada") return "pendiente";
  return APPOINTMENT_STATUS.has(status) ? status : "pendiente";
}

function normalizeStatusUpdate(value) {
  const status = normalizeString(value).toLowerCase();
  if (status === "programada") return "pendiente";
  return APPOINTMENT_STATUS.has(status) ? status : "";
}

function parseDateInput(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function getStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEndOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function buildClientName(user) {
  if (!user || typeof user !== "object") return "Cliente";
  return [user.nombre, user.apellidoPaterno, user.apellidoMaterno]
    .map((part) => normalizeString(part))
    .filter(Boolean)
    .join(" ") || "Cliente";
}

function buildAppointmentResponse(appointment, stylistId) {
  const client = appointment.userId && typeof appointment.userId === "object"
    ? appointment.userId
    : null;
  const assignedStylistId = appointment.stylistId ? String(appointment.stylistId) : "";

  return {
    id: String(appointment._id),
    _id: String(appointment._id),
    cliente: buildClientName(client),
    clienteCorreo: client?.correo || "",
    clienteTelefono: client?.telefono || "",
    servicio: appointment.servicio || "",
    fechaHora: appointment.fechaHora,
    notas: appointment.notas || "",
    estado: normalizeStatus(appointment.estado),
    stylistId: assignedStylistId,
    asignada: assignedStylistId === String(stylistId || ""),
    sinAsignar: !assignedStylistId,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}

function buildOwnershipFilter(stylistId) {
  const objectId = new mongoose.Types.ObjectId(stylistId);
  return {
    $or: [
      { stylistId: objectId },
      { stylistId: null },
      { stylistId: { $exists: false } },
    ],
  };
}

function buildDateFilter(req, res) {
  const desdeRaw = normalizeString(req.query.desde || "");
  const hastaRaw = normalizeString(req.query.hasta || "");
  let desde = null;
  let hasta = null;

  if (desdeRaw) {
    const parsed = parseDateInput(desdeRaw);
    if (!parsed) {
      res.status(400).json({ errors: ["Fecha inicio invalida."] });
      return null;
    }
    desde = getStartOfDay(parsed);
  }

  if (hastaRaw) {
    const parsed = parseDateInput(hastaRaw);
    if (!parsed) {
      res.status(400).json({ errors: ["Fecha fin invalida."] });
      return null;
    }
    hasta = getEndOfDay(parsed);
  }

  if (desde && hasta && desde > hasta) {
    res.status(400).json({ errors: ["La fecha inicio no puede ser mayor que la fecha fin."] });
    return null;
  }

  const dateFilter = {};
  if (desde || hasta) {
    dateFilter.fechaHora = {};
    if (desde) dateFilter.fechaHora.$gte = desde;
    if (hasta) dateFilter.fechaHora.$lte = hasta;
  }
  return dateFilter;
}

async function requireStylist(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ errors: ["No autorizado."] });
  }

  if (payload.role !== "stylist") {
    return res.status(403).json({ errors: ["Acceso denegado para este rol."] });
  }

  const user = await User.findOne({
    _id: payload.id,
    role: "stylist",
    accountStatus: "active",
  }).lean();

  if (!user) {
    return res.status(403).json({ errors: ["La cuenta de estilista no esta activa."] });
  }

  req.stylist = {
    id: String(user._id),
    nombre: user.nombre || "",
    correo: user.correo || "",
    username: user.username || "",
    role: user.role,
  };

  return next();
}

async function getOrCreateAvailability(stylistId) {
  let availability = await StylistAvailability.findOne({ stylistId });
  if (!availability) {
    const defaults = getDefaultAvailability(stylistId);
    availability = await StylistAvailability.create(defaults);
  }
  return availability;
}

router.use(requireStylist);

router.get("/me", async (req, res) => {
  const staff = await StaffMember.findOne({ userId: req.stylist.id }).lean();
  return res.json({
    user: req.stylist,
    staff: staff
      ? {
        id: String(staff._id),
        nombre: staff.nombre || "",
        rol: staff.rol || "",
        email: staff.email || "",
        telefono: staff.telefono || "",
        estado: staff.estado || "",
      }
      : null,
  });
});

router.get("/availability", async (req, res) => {
  const availability = await getOrCreateAvailability(req.stylist.id);
  return res.json({ availability: mapAvailability(availability.toObject(), req.stylist.id) });
});

router.put("/availability", async (req, res) => {
  const availability = await getOrCreateAvailability(req.stylist.id);

  availability.slotMinutes = normalizeSlotMinutes(req.body.slotMinutes);
  availability.weeklySchedule = normalizeWeeklySchedule(req.body.weeklySchedule);
  availability.blockedPeriods = normalizeBlockedPeriods(req.body.blockedPeriods);
  await availability.save();

  return res.json({
    message: "Disponibilidad actualizada.",
    availability: mapAvailability(availability.toObject(), req.stylist.id),
  });
});

router.get("/appointments", async (req, res) => {
  const dateFilter = buildDateFilter(req, res);
  if (!dateFilter) return null;

  const estadoRaw = normalizeString(req.query.estado || "Todos");
  const filter = {
    ...buildOwnershipFilter(req.stylist.id),
    ...dateFilter,
  };

  if (estadoRaw && estadoRaw !== "Todos") {
    const estado = normalizeStatus(estadoRaw);
    filter.estado = estado === "pendiente" ? { $in: ["pendiente", "programada"] } : estado;
  }

  const appointments = await Appointment.find(filter)
    .populate("userId", "nombre apellidoPaterno apellidoMaterno correo telefono")
    .sort({ fechaHora: 1, createdAt: -1 })
    .lean();

  return res.json({
    appointments: appointments.map((appointment) => buildAppointmentResponse(appointment, req.stylist.id)),
  });
});

router.patch("/appointments/:id/status", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Cita invalida."] });
  }

  const estado = normalizeStatusUpdate(req.body.estado);
  if (!APPOINTMENT_STATUS.has(estado)) {
    return res.status(400).json({ errors: ["Estado invalido."] });
  }

  const appointment = await Appointment.findOne({
    _id: id,
    ...buildOwnershipFilter(req.stylist.id),
  });

  if (!appointment) {
    return res.status(404).json({ errors: ["Cita no encontrada para este estilista."] });
  }

  if (!appointment.stylistId) {
    appointment.stylistId = req.stylist.id;
  }
  appointment.estado = estado;
  await appointment.save();

  const populated = await Appointment.findById(appointment._id)
    .populate("userId", "nombre apellidoPaterno apellidoMaterno correo telefono")
    .lean();

  return res.json({
    message: "Cita actualizada.",
    appointment: buildAppointmentResponse(populated, req.stylist.id),
  });
});

module.exports = router;
