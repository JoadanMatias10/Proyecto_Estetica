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
    AccountAccessToken,
    ACCOUNT_STATUS,
    INVITE_EXPIRATION_MS,
    createPlaceholderCredentials,
    issueAccessToken,
    mapStaffRoleToUserRole,
    sendInviteEmail,
    isValidId,
  } = contexto;

  const INTERNAL_ROLE_FILTER = { role: { $in: ["admin", "stylist"] } };

  function mapStaffResponse(staffRecord, linkedUser = null) {
    const source = mapId(staffRecord);
    const userId = linkedUser?._id || source.userId || "";

    return {
      ...source,
      userId: userId ? String(userId) : "",
      accountStatus: linkedUser?.accountStatus || "",
      passwordSetupRequired: Boolean(linkedUser?.passwordSetupRequired),
      inviteSentAt: linkedUser?.inviteSentAt || null,
      linkedRole: linkedUser?.role || "",
    };
  }

  async function findLinkedUser(staff, emailOverride = "") {
    if (staff?.userId && isValidId(String(staff.userId))) {
      const byId = await User.findOne({ _id: staff.userId, ...INTERNAL_ROLE_FILTER });
      if (byId) return byId;
    }

    const email = sanitizeText(emailOverride || staff?.email).toLowerCase();
    if (!email) return null;
    return findOneCaseInsensitive(User, "correo", email, null, INTERNAL_ROLE_FILTER);
  }

  async function listStaffWithAccounts() {
    await syncAdminUsersAsStaff();
    const staffList = await StaffMember.find().sort({ createdAt: -1 }).lean();
    if (!staffList.length) return [];

    const userIds = staffList
      .map((item) => (item.userId ? String(item.userId) : ""))
      .filter(Boolean);
    const emails = staffList
      .map((item) => sanitizeText(item.email).toLowerCase())
      .filter(Boolean);

    const users = await User.find({
      ...INTERNAL_ROLE_FILTER,
      $or: [
        ...(userIds.length ? [{ _id: { $in: userIds } }] : []),
        ...(emails.length ? [{ correo: { $in: emails } }] : []),
      ],
    }).lean();

    const usersById = new Map(users.map((user) => [String(user._id), user]));
    const usersByEmail = new Map(users.map((user) => [sanitizeText(user.correo).toLowerCase(), user]));

    return staffList.map((staff) => {
      const linkedUser =
        usersById.get(String(staff.userId || "")) ||
        usersByEmail.get(sanitizeText(staff.email).toLowerCase()) ||
        null;
      return mapStaffResponse(staff, linkedUser);
    });
  }

  async function validateUserConflicts({ email, telefono, excludeUserId = null }) {
    const duplicatedUserEmail = await findOneCaseInsensitive(User, "correo", email, excludeUserId);
    if (duplicatedUserEmail) {
      return "Ya existe un usuario con ese correo.";
    }

    const phoneQuery = excludeUserId
      ? { telefono, _id: { $ne: excludeUserId } }
      : { telefono };
    const duplicatedUserPhone = await User.findOne(phoneQuery);
    if (duplicatedUserPhone) {
      return "Ya existe un usuario con ese telefono.";
    }

    return "";
  }

  async function ensureLinkedUserForStaff({ staff, nombre, rol, email, telefono, estado }) {
    const desiredRole = mapStaffRoleToUserRole(rol);
    if (!desiredRole) {
      return { linkedUser: null, created: false };
    }

    let linkedUser = await findLinkedUser(staff, email);
    const nextAccountStatus =
      estado === "Inactivo"
        ? ACCOUNT_STATUS.INACTIVE
        : linkedUser?.passwordSetupRequired || linkedUser?.accountStatus === ACCOUNT_STATUS.PENDING
          ? ACCOUNT_STATUS.PENDING
          : ACCOUNT_STATUS.ACTIVE;

    if (linkedUser) {
      linkedUser.nombre = nombre;
      linkedUser.correo = email;
      linkedUser.telefono = telefono;
      linkedUser.role = desiredRole;
      linkedUser.accountStatus = nextAccountStatus;
      await linkedUser.save();

      if (!staff.userId || String(staff.userId) !== String(linkedUser._id)) {
        staff.userId = linkedUser._id;
        await staff.save();
      }

      return { linkedUser, created: false };
    }

    const credentials = createPlaceholderCredentials();
    linkedUser = await User.create({
      nombre,
      apellidoPaterno: "",
      apellidoMaterno: "",
      telefono,
      correo: email,
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
      role: desiredRole,
      accountStatus: estado === "Inactivo" ? ACCOUNT_STATUS.INACTIVE : ACCOUNT_STATUS.PENDING,
      passwordSetupRequired: true,
    });

    staff.userId = linkedUser._id;
    await staff.save();

    return { linkedUser, created: true };
  }

  async function sendInvite(linkedUser, createdByUserId = null) {
    linkedUser.accountStatus = ACCOUNT_STATUS.PENDING;
    linkedUser.passwordSetupRequired = true;

    const { rawToken } = await issueAccessToken(AccountAccessToken, {
      userId: linkedUser._id,
      type: "invite",
      expiresInMs: INVITE_EXPIRATION_MS,
      createdByUserId,
    });

    await sendInviteEmail(linkedUser, rawToken);
    linkedUser.inviteSentAt = new Date();
    await linkedUser.save();
  }

  router.get("/staff", async (_req, res) => {
    const staff = await listStaffWithAccounts();
    return res.json({ staff });
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

    const userConflictMessage = await validateUserConflicts({ email, telefono });
    if (userConflictMessage) {
      return res.status(409).json({ errors: [userConflictMessage] });
    }

    const staff = await StaffMember.create({
      nombre,
      rol,
      email,
      telefono,
      estado,
    });

    let linkedUser = null;
    let message = "Personal creado.";
    let warning = "";

    const { linkedUser: ensuredUser } = await ensureLinkedUserForStaff({
      staff,
      nombre,
      rol,
      email,
      telefono,
      estado,
    });
    linkedUser = ensuredUser;

    if (linkedUser && estado === "Activo") {
      try {
        await sendInvite(linkedUser, req.admin?.id || null);
        message = "Personal creado e invitacion enviada.";
      } catch (_error) {
        warning = "Personal creado, pero no fue posible enviar la invitacion.";
      }
    }

    return res.status(201).json({
      staff: mapStaffResponse(staff.toObject(), linkedUser),
      message,
      warning,
    });
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
    const estadoAnterior = current.estado;
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

    const linkedUserBefore = await findLinkedUser(current, emailAnterior);
    const userConflictMessage = await validateUserConflicts({
      email,
      telefono,
      excludeUserId: linkedUserBefore?._id || null,
    });
    if (userConflictMessage) {
      return res.status(409).json({ errors: [userConflictMessage] });
    }

    current.nombre = nombre;
    current.rol = rol;
    current.email = email;
    current.telefono = telefono;
    current.estado = estado;
    await current.save();

    let linkedUser = linkedUserBefore;
    let warning = "";
    let message = "Personal actualizado.";

    const desiredRole = mapStaffRoleToUserRole(rol);
    if (desiredRole) {
      const result = await ensureLinkedUserForStaff({
        staff: current,
        nombre,
        rol,
        email,
        telefono,
        estado,
      });
      linkedUser = result.linkedUser;

      const shouldResendInvite =
        linkedUser &&
        linkedUser.passwordSetupRequired &&
        estado === "Activo" &&
        (result.created || email !== emailAnterior || estadoAnterior !== "Activo" || !linkedUser.inviteSentAt);

      if (shouldResendInvite) {
        try {
          await sendInvite(linkedUser, req.admin?.id || null);
          message = result.created
            ? "Personal actualizado e invitacion enviada."
            : "Personal actualizado e invitacion reenviada.";
        } catch (_error) {
          warning = "Personal actualizado, pero no fue posible enviar la invitacion.";
        }
      }
    }

    return res.json({
      staff: mapStaffResponse(current.toObject(), linkedUser),
      message,
      warning,
    });
  });

  router.post("/staff/:id/invite", async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ errors: ["Personal invalido."] });
    }

    const current = await StaffMember.findById(id);
    if (!current) {
      return res.status(404).json({ errors: ["Personal no encontrado."] });
    }

    if (current.estado !== "Activo") {
      return res.status(400).json({ errors: ["Activa al personal antes de enviar una invitacion."] });
    }

    const desiredRole = mapStaffRoleToUserRole(current.rol);
    if (!desiredRole) {
      return res.status(400).json({ errors: ["El rol actual no admite acceso al sistema."] });
    }

    const result = await ensureLinkedUserForStaff({
      staff: current,
      nombre: sanitizeText(current.nombre),
      rol: sanitizeStaffRole(current.rol),
      email: sanitizeText(current.email).toLowerCase(),
      telefono: sanitizeText(current.telefono),
      estado: sanitizeStaffStatus(current.estado),
    });

    try {
      await sendInvite(result.linkedUser, req.admin?.id || null);
    } catch (error) {
      return res.status(500).json({ errors: ["No fue posible enviar la invitacion."] });
    }

    return res.json({
      staff: mapStaffResponse(current.toObject(), result.linkedUser),
      message: "Invitacion enviada correctamente.",
    });
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

    const linkedUser = await findLinkedUser(current);
    if (linkedUser?.role === "admin") {
      return res.status(409).json({ errors: ["No puedes eliminar al administrador principal."] });
    }

    await StaffMember.findByIdAndDelete(id);

    if (linkedUser?.role === "stylist") {
      await AccountAccessToken.deleteMany({ userId: linkedUser._id });
      await User.findByIdAndDelete(linkedUser._id);
    }

    return res.json({ message: "Personal eliminado." });
  });
}

module.exports = registrarStaffAdminRoutes;
