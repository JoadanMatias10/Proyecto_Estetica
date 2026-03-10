const express = require("express");
const Appointment = require("../models/Cita");
const User = require("../models/Usuario");
const { verifyToken } = require("../utils/auth");
const {
  normalizeString,
  validateName,
  validateEmail,
  validatePhone,
  validateDateTime,
  validateService,
  validateNotes,
} = require("../utils/validadores");

const router = express.Router();

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
  return res.json({
    user: {
      id: user._id,
      nombre: user.nombre,
      telefono: user.telefono,
      correo: user.correo,
    },
  });
});

router.post("/profile/:id", async (req, res) => {
  const errors = [];
  const { id } = req.params;
  if (id !== req.user.id) {
    return res.status(403).json({ errors: ["Acceso denegado."] });
  }
  const { nombre, telefono, correo } = req.body;

  validateName(nombre, "Nombre", errors);
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
    user: {
      id: user._id,
      nombre: user.nombre,
      telefono: user.telefono,
      correo: user.correo,
    },
  });
});

router.post("/appointments", async (req, res) => {
  const errors = [];
  const { servicio, fecha, hora, notas } = req.body;

  validateService(servicio, errors);
  const fechaHora = validateDateTime(fecha, hora, errors);
  validateNotes(notas, errors);

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ errors: ["Cliente no encontrado."] });
  }

  const appointment = await Appointment.create({
    userId: req.user.id,
    servicio: normalizeString(servicio),
    fechaHora,
    notas: normalizeString(notas),
  });

  return res.status(201).json({
    message: "Cita agendada correctamente.",
    appointment: {
      id: appointment._id,
      servicio: appointment.servicio,
      fechaHora: appointment.fechaHora,
      notas: appointment.notas,
      estado: appointment.estado,
    },
  });
});

router.post("/appointments/:id/reprogram", async (req, res) => {
  const errors = [];
  const { id } = req.params;
  const { fecha, hora } = req.body;

  const fechaHora = validateDateTime(fecha, hora, errors);
  if (errors.length) {
    return res.status(400).json({ errors });
  }

  const appointment = await Appointment.findOneAndUpdate(
    { _id: id, userId: req.user.id },
    { fechaHora },
    { new: true }
  );

  if (!appointment) {
    return res.status(404).json({ errors: ["Cita no encontrada."] });
  }

  return res.json({
    message: "Cita reprogramada.",
    appointment: {
      id: appointment._id,
      servicio: appointment.servicio,
      fechaHora: appointment.fechaHora,
      notas: appointment.notas,
      estado: appointment.estado,
    },
  });
});

module.exports = router;
