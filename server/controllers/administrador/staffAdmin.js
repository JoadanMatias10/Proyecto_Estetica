function registrarStaffAdminRoutes(router, contexto) {
  const {
    syncAdminUsersAsStaff,
    StaffMember,
    mapId,
    sanitizeText,
    sanitizeStaffRole,
    sanitizeStaffStatus,
    findOneCaseInsensitive,
    User,
    isValidId,
  } = contexto;

router.get("/staff", async (_req, res) => {
  await syncAdminUsersAsStaff();
  const staff = await StaffMember.find().sort({ createdAt: -1 }).lean();
  return res.json({ staff: staff.map(mapId) });
});

router.post("/staff", async (req, res) => {
  const nombre = sanitizeText(req.body.nombre);
  const rol = sanitizeStaffRole(req.body.rol);
  const email = sanitizeText(req.body.email).toLowerCase();
  const telefono = sanitizeText(req.body.telefono);
  const estado = sanitizeStaffStatus(req.body.estado);

  const errors = [];
  if (!nombre) errors.push("Nombre es obligatorio.");
  if (!email) errors.push("Email es obligatorio.");
  if (!telefono) errors.push("Telefono es obligatorio.");
  if (errors.length) return res.status(400).json({ errors });

  const duplicatedEmail = await findOneCaseInsensitive(StaffMember, "email", email);
  if (duplicatedEmail) {
    return res.status(409).json({ errors: ["Ya existe personal con ese email."] });
  }
  const duplicatedPhone = await StaffMember.findOne({ telefono });
  if (duplicatedPhone) {
    return res.status(409).json({ errors: ["Ya existe personal con ese telefono."] });
  }

  const staff = await StaffMember.create({
    nombre,
    rol,
    email,
    telefono,
    estado,
  });

  return res.status(201).json({ staff: mapId(staff.toObject()) });
});

router.put("/staff/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Personal invalido."] });
  }

  const current = await StaffMember.findById(id);
  if (!current) {
    return res.status(404).json({ errors: ["Personal no encontrado."] });
  }

  const emailAnterior = sanitizeText(current.email).toLowerCase();
  const nombre = sanitizeText(req.body.nombre);
  const rol = sanitizeStaffRole(req.body.rol);
  const email = sanitizeText(req.body.email).toLowerCase();
  const telefono = sanitizeText(req.body.telefono);
  const estado = sanitizeStaffStatus(req.body.estado);

  const errors = [];
  if (!nombre) errors.push("Nombre es obligatorio.");
  if (!email) errors.push("Email es obligatorio.");
  if (!telefono) errors.push("Telefono es obligatorio.");
  if (errors.length) return res.status(400).json({ errors });

  const duplicatedEmail = await findOneCaseInsensitive(StaffMember, "email", email, id);
  if (duplicatedEmail) {
    return res.status(409).json({ errors: ["Ya existe personal con ese email."] });
  }
  const duplicatedPhone = await StaffMember.findOne({ telefono, _id: { $ne: id } });
  if (duplicatedPhone) {
    return res.status(409).json({ errors: ["Ya existe personal con ese telefono."] });
  }

  const linkedAdmin =
    (await findOneCaseInsensitive(User, "correo", emailAnterior, null, { role: "admin" })) ||
    (email !== emailAnterior
      ? await findOneCaseInsensitive(User, "correo", email, null, { role: "admin" })
      : null);

  if (linkedAdmin) {
    const duplicatedUserEmail = await findOneCaseInsensitive(User, "correo", email, linkedAdmin._id);
    if (duplicatedUserEmail) {
      return res.status(409).json({ errors: ["Ya existe un usuario con ese correo."] });
    }

    const duplicatedUserPhone = await User.findOne({
      telefono,
      _id: { $ne: linkedAdmin._id },
    });
    if (duplicatedUserPhone) {
      return res.status(409).json({ errors: ["Ya existe un usuario con ese telefono."] });
    }
  }

  current.nombre = nombre;
  current.rol = rol;
  current.email = email;
  current.telefono = telefono;
  current.estado = estado;
  await current.save();

  if (linkedAdmin) {
    linkedAdmin.nombre = nombre;
    linkedAdmin.correo = email;
    linkedAdmin.telefono = telefono;
    await linkedAdmin.save();
  }

  return res.json({ staff: mapId(current.toObject()) });
});

router.delete("/staff/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Personal invalido."] });
  }

  const current = await StaffMember.findById(id);
  if (!current) {
    return res.status(404).json({ errors: ["Personal no encontrado."] });
  }

  const linkedAdmin = await findOneCaseInsensitive(
    User,
    "correo",
    current.email || "",
    null,
    { role: "admin" }
  );
  if (linkedAdmin) {
    return res.status(409).json({ errors: ["No puedes eliminar al administrador principal."] });
  }

  await StaffMember.findByIdAndDelete(id);
  return res.json({ message: "Personal eliminado." });
});
}

module.exports = registrarStaffAdminRoutes;
