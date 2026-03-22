const StaffMember = require("../models/MiembroPersonal");
const User = require("../models/Usuario");
const {
  ACCOUNT_STATUS,
  mapUserRoleToStaffRole,
} = require("./accountAccess");
const {
  DEFAULT_STAFF_MEMBERS,
} = require("./datosCatalogoPredeterminado");

async function ensureAdminStaffMembers() {
  const adminUsers = await User.find({ role: { $in: ["admin", "stylist"] } })
    .select("nombre username correo telefono role accountStatus")
    .lean();

  for (const adminUser of adminUsers) {
    const email = (adminUser.correo || "").trim().toLowerCase();
    const telefono = (adminUser.telefono || "").trim();
    const nombre = (adminUser.nombre || adminUser.username || "Administrador").trim();
    const rol = mapUserRoleToStaffRole(adminUser.role) || "Estilista";
    const estado = adminUser.accountStatus === ACCOUNT_STATUS.INACTIVE ? "Inactivo" : "Activo";
    if (!email || !telefono) continue;

    const byEmail = await StaffMember.findOne({ email });
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
