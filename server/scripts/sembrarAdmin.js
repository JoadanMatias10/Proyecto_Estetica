require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/Usuario");
const { hashPassword } = require("../utils/contrasena");

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return (process.argv[index + 1] || "").trim();
}

function getPositionalArg(index) {
  const values = process.argv
    .slice(2)
    .filter((value) => value && !value.startsWith("--"));
  return (values[index] || "").trim();
}

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function buildFallbackPhone(seed) {
  const digits = seed
    .split("")
    .map((ch) => ch.charCodeAt(0) % 10)
    .join("");
  const padded = `9${digits}`.replace(/\D/g, "").slice(0, 10);
  return padded.length === 10 ? padded : "9000000000";
}

async function findAvailablePhone(preferredPhone) {
  let phone = preferredPhone;
  let attempt = 0;
  while (attempt < 50) {
    const exists = await User.findOne({ telefono: phone });
    if (!exists) return phone;
    attempt += 1;
    const prefix = (900 + Math.floor(Math.random() * 99)).toString();
    const suffix = Math.floor(Math.random() * 10000000).toString().padStart(7, "0");
    phone = `${prefix}${suffix}`.slice(0, 10);
  }
  throw new Error("No fue posible generar un telefono unico para el administrador.");
}

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "Estetica_Panamericana";

  if (!mongoUri) throw new Error("MONGODB_URI no configurado.");

  const username = normalizeUsername(
    getArgValue("--username") || getPositionalArg(0) || process.env.ADMIN_USERNAME || "estetica"
  );
  const plainPassword =
    getArgValue("--password") || getPositionalArg(1) || process.env.ADMIN_PASSWORD || "";

  if (!username) throw new Error("Debes indicar --username o ADMIN_USERNAME.");
  if (!plainPassword) throw new Error("Debes indicar --password o ADMIN_PASSWORD.");

  const email =
    (getArgValue("--email") || process.env.ADMIN_EMAIL || `${username}@panamericana.local`)
      .trim()
      .toLowerCase();

  const firstName = (getArgValue("--nombre") || process.env.ADMIN_NOMBRE || "Estetica").trim();
  const apellidoPaterno = (getArgValue("--apellidoPaterno") || process.env.ADMIN_APELLIDO_PATERNO || "Administrador").trim();
  const apellidoMaterno = (getArgValue("--apellidoMaterno") || process.env.ADMIN_APELLIDO_MATERNO || "Sistema").trim();

  await mongoose.connect(mongoUri, { dbName });

  const requestedPhone = (getArgValue("--telefono") || process.env.ADMIN_TELEFONO || buildFallbackPhone(username))
    .replace(/\D/g, "")
    .slice(0, 10);
  const phone = await findAvailablePhone(requestedPhone || buildFallbackPhone(username));

  const { hash, salt } = hashPassword(plainPassword);

  const existingByUsername = await User.findOne({ username });
  const existingByEmail = await User.findOne({ correo: email });
  const target = existingByUsername || existingByEmail;

  if (target) {
    target.username = username;
    target.nombre = firstName;
    target.apellidoPaterno = apellidoPaterno;
    target.apellidoMaterno = apellidoMaterno;
    target.correo = email;
    target.telefono = target.telefono || phone;
    target.passwordHash = hash;
    target.passwordSalt = salt;
    target.role = "admin";
    await target.save();
    console.log(`Admin actualizado: ${target.username} (${target.correo})`);
  } else {
    const created = await User.create({
      username,
      nombre: firstName,
      apellidoPaterno,
      apellidoMaterno,
      telefono: phone,
      correo: email,
      passwordHash: hash,
      passwordSalt: salt,
      role: "admin",
    });
    console.log(`Admin creado: ${created.username} (${created.correo})`);
  }

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("Error seed admin:", error.message);
    try {
      await mongoose.disconnect();
    } catch (_error) {
      // ignore
    }
    process.exit(1);
  });
