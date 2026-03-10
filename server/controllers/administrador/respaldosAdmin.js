function registrarRespaldosAdminRoutes(router, contexto) {
  const {
    sanitizeText,
    obtenerNombresColeccionesDisponibles,
    obtenerResumenColeccion,
    historialRespaldos,
    crearIdRespaldo,
    guardarResumenEnHistorial,
    mongoose,
  } = contexto;

router.get("/respaldos/colecciones", async (_req, res) => {
  const nombresColecciones = await obtenerNombresColeccionesDisponibles();
  const resumenes = await Promise.all(
    nombresColecciones.map((nombreColeccion) => obtenerResumenColeccion(nombreColeccion))
  );

  resumenes.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));

  return res.json({
    colecciones: resumenes,
    totalColecciones: resumenes.length,
  });
});

router.get("/respaldos/historial", async (_req, res) => {
  return res.json({ historial: historialRespaldos });
});

router.post("/respaldos/crear", async (req, res) => {
  const tipoSolicitud = sanitizeText(req.body.tipo).toLowerCase();
  const coleccionesSolicitadas = Array.isArray(req.body.colecciones)
    ? req.body.colecciones.map((nombre) => sanitizeText(nombre)).filter(Boolean)
    : [];

  const nombresDisponibles = await obtenerNombresColeccionesDisponibles();
  const disponiblesSet = new Set(nombresDisponibles);

  let coleccionesRespaldo = [];
  if (tipoSolicitud === "completo") {
    coleccionesRespaldo = [...nombresDisponibles].sort((a, b) => a.localeCompare(b, "es"));
  } else if (tipoSolicitud === "colecciones") {
    if (coleccionesSolicitadas.length === 0) {
      return res.status(400).json({ errors: ["Debes seleccionar al menos una coleccion."] });
    }

    const coleccionesInvalidas = coleccionesSolicitadas.filter(
      (nombre) => !disponiblesSet.has(nombre)
    );
    if (coleccionesInvalidas.length > 0) {
      return res.status(400).json({
        errors: [`Colecciones invalidas: ${coleccionesInvalidas.join(", ")}`],
      });
    }

    coleccionesRespaldo = Array.from(new Set(coleccionesSolicitadas))
      .sort((a, b) => a.localeCompare(b, "es"));
  } else {
    return res.status(400).json({
      errors: ["Tipo de respaldo invalido. Usa 'completo' o 'colecciones'."],
    });
  }

  const db = mongoose.connection.db;
  const datos = {};
  let totalDocumentos = 0;

  for (const nombreColeccion of coleccionesRespaldo) {
    const documentos = await db.collection(nombreColeccion).find({}).toArray();
    datos[nombreColeccion] = documentos;
    totalDocumentos += documentos.length;
  }

  const fechaRespaldo = new Date().toISOString();
  const descripcionTipo = tipoSolicitud === "completo" ? "Completo" : "Por colecciones";
  const metadata = {
    sistema: "Estetica Panamericana",
    fechaRespaldo,
    tipo: descripcionTipo,
    colecciones: coleccionesRespaldo,
    totalColecciones: coleccionesRespaldo.length,
    totalDocumentos,
  };

  const respaldo = { metadata, datos };
  const contenidoSerializado = JSON.stringify(respaldo, null, 2);
  const tamanoBytes = Buffer.byteLength(contenidoSerializado, "utf8");

  const resumen = {
    id: crearIdRespaldo(),
    fecha: fechaRespaldo,
    tipo: descripcionTipo,
    colecciones: coleccionesRespaldo,
    totalColecciones: coleccionesRespaldo.length,
    totalDocumentos,
    tamanoBytes,
    tamanoMb: Number((tamanoBytes / (1024 * 1024)).toFixed(2)),
    estado: "Completado",
  };

  guardarResumenEnHistorial(resumen);

  return res.json({ resumen, respaldo });
});
}

module.exports = registrarRespaldosAdminRoutes;
