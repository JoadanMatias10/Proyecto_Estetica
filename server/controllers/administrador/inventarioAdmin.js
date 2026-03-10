function registrarInventarioAdminRoutes(router, contexto) {
  const {
    sanitizeText,
    sanitizeInventoryAction,
    parsePositiveNumber,
    findOneCaseInsensitive,
    Product,
    InventoryMovement,
    mapId,
  } = contexto;

router.get("/inventory/movements", async (req, res) => {
  const actionRaw = sanitizeText(req.query.action || "Todos");
  const query = {};
  if (actionRaw === "Entrada" || actionRaw === "Salida") {
    query.accion = actionRaw;
  }

  const movements = await InventoryMovement.find(query).sort({ createdAt: -1 }).lean();
  return res.json({ movements: movements.map(mapId) });
});

router.post("/inventory/movements", async (req, res) => {
  const producto = sanitizeText(req.body.producto);
  const accion = sanitizeInventoryAction(req.body.accion);
  const cantidad = parsePositiveNumber(req.body.cantidad, NaN);
  const usuario =
    sanitizeText(req.body.usuario) ||
    sanitizeText(req.admin.username) ||
    sanitizeText(req.admin.correo) ||
    "Admin";

  const errors = [];
  if (!producto) errors.push("Producto es obligatorio.");
  if (!Number.isFinite(cantidad) || cantidad <= 0) errors.push("Cantidad invalida.");
  if (errors.length) return res.status(400).json({ errors });

  const product = await findOneCaseInsensitive(Product, "nombre", producto);
  if (!product) {
    return res.status(404).json({ errors: ["Producto no encontrado."] });
  }

  const stockAnterior = Number(product.stock || 0);
  if (accion === "Salida" && stockAnterior < cantidad) {
    return res.status(400).json({ errors: ["Stock insuficiente para registrar salida."] });
  }

  const stockActual = accion === "Entrada"
    ? stockAnterior + cantidad
    : stockAnterior - cantidad;

  product.stock = stockActual;
  await product.save();

  const movement = await InventoryMovement.create({
    producto: product.nombre,
    accion,
    cantidad,
    usuario,
    stockAnterior,
    stockActual,
  });

  return res.status(201).json({ movement: mapId(movement.toObject()) });
});

router.get("/inventory/alerts", async (req, res) => {
  const threshold = parsePositiveNumber(req.query.threshold, 10);
  const alerts = await Product.find({ stock: { $lte: threshold } })
    .sort({ stock: 1, nombre: 1 })
    .select("nombre stock")
    .lean();

  return res.json({
    threshold,
    alerts: alerts.map((product) => ({
      id: product._id.toString(),
      nombre: product.nombre,
      stock: Number(product.stock || 0),
    })),
  });
});
}

module.exports = registrarInventarioAdminRoutes;
