function registrarAuthAdminRoutes(router, contexto) {
  const {
    normalizeString,
    getKey,
    getState,
    registerFailure,
    clearState,
    User,
    verifyPassword,
    createToken,
    verifyToken,
  } = contexto;

router.post("/login", async (req, res) => {
  const usuario = normalizeString(req.body.usuario).toLowerCase();
  const password = req.body.password || "";

  if (!usuario) {
    return res.status(400).json({ errors: ["Usuario es obligatorio."] });
  }
  if (!password) {
    return res.status(400).json({ errors: ["Contrasena es obligatoria."] });
  }

  const key = getKey(req, usuario);
  const state = getState(key);
  if (state.blockedUntil && Date.now() < state.blockedUntil) {
    const remainingSec = Math.ceil((state.blockedUntil - Date.now()) / 1000);
    return res.status(429).json({ errors: [`Demasiados intentos. Intenta en ${remainingSec} segundos.`] });
  }

  const user = await User.findOne({
    role: "admin",
    $or: [{ username: usuario }, { correo: usuario }],
  });

  if (!user) {
    registerFailure(key);
    return res.status(401).json({ errors: ["Credenciales invalidas."] });
  }

  const isValid = verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!isValid) {
    registerFailure(key);
    return res.status(401).json({ errors: ["Credenciales invalidas."] });
  }

  clearState(key);

  return res.json({
    message: "Inicio de sesion admin correcto.",
    token: createToken(
      { id: user._id, correo: user.correo, username: user.username, role: user.role },
      { expiresInSec: 60 * 60 * 8 }
    ),
    user: {
      id: user._id,
      nombre: user.nombre,
      correo: user.correo,
      username: user.username,
      role: user.role,
    },
  });
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload || payload.role !== "admin") {
    return res.status(401).json({ errors: ["No autorizado."] });
  }

  const user = await User.findOne({ _id: payload.id, role: "admin" });
  if (!user) {
    return res.status(404).json({ errors: ["Administrador no encontrado."] });
  }

  return res.json({
    user: {
      id: user._id,
      nombre: user.nombre,
      correo: user.correo,
      username: user.username,
      role: user.role,
    },
  });
});

}

module.exports = registrarAuthAdminRoutes;
