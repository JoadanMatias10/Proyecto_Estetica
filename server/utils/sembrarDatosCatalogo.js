const StaffMember = require("../models/MiembroPersonal");
const User = require("../models/Usuario");
const {
  DEFAULT_STAFF_MEMBERS,
} = require("./datosCatalogoPredeterminado");

async function ensureAdminStaffMembers() {
  const adminUsers = await User.find({ role: "admin" })
    .select("nombre username correo telefono")
    .lean();

  for (const adminUser of adminUsers) {
    const email = (adminUser.correo || "").trim().toLowerCase();
    const telefono = (adminUser.telefono || "").trim();
    const nombre = (adminUser.nombre || adminUser.username || "Administrador").trim();
    if (!email || !telefono) continue;

    const byEmail = await StaffMember.findOne({ email });
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

async function cleanupLegacySeedStaff() {
  const legacyEmails = DEFAULT_STAFF_MEMBERS
    .map((item) => String(item.email || "").trim().toLowerCase())
    .filter(Boolean);
  if (legacyEmails.length === 0) return;

  const allStaff = await StaffMember.find().select("email").lean();
  if (allStaff.length === 0) return;

  const normalizedEmails = allStaff.map((item) => String(item.email || "").trim().toLowerCase());
  const hasOnlyLegacy = normalizedEmails.every((email) => legacyEmails.includes(email));
  if (!hasOnlyLegacy) return;

  await StaffMember.deleteMany({ email: { $in: legacyEmails } });
}

async function ensureCatalogData() {
  await cleanupLegacySeedStaff();
  await ensureAdminStaffMembers();
}

module.exports = { ensureCatalogData };
