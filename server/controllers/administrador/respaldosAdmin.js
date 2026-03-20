const fs = require("fs");
const path = require("path");

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

  const SCHEDULE_COLLECTION = "configuracion_respaldo_automatico_admin";
  const SCHEDULE_DOC_ID = "admin-backup-schedule";
  const BACKUP_DIR = path.join(process.cwd(), "backups", "admin");
  const MAX_SAVED_FILES = 20;
  const MAX_HISTORY = 50;
  const DELAY_MIN_MS = 1000;
  const backupArtifacts = new Map();

  let scheduleConfig = null;
  let scheduleTimer = null;
  let isRunningAutomatic = false;
  let bootstrapLoading = false;

  function normalizeType(value) {
    const normalized = sanitizeText(value).toLowerCase();
    return normalized === "colecciones" ? "colecciones" : "completo";
  }

  function normalizeMode(value) {
    const normalized = sanitizeText(value).toLowerCase();
    if (normalized === "time" || normalized === "hora" || normalized === "daily") {
      return "time";
    }
    return "time";
  }

  function parseTime(value) {
    const raw = sanitizeText(value || "");
    const matched = raw.match(/^([01]?\d|2[0-3]):([0-5]?\d)(?::([0-5]?\d))?$/);
    if (!matched) return null;
    const hour = Number(matched[1]);
    const minute = Number(matched[2]);
    const second = Number(matched[3] || 0);
    return {
      raw: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
      hour,
      minute,
      second,
    };
  }

  function getScheduleDefaults() {
    return {
      _id: SCHEDULE_DOC_ID,
      active: false,
      mode: "time",
      tipo: "completo",
      time: "",
      colecciones: [],
      nextRunAt: null,
      lastRunAt: null,
      lastError: "",
      updatedBy: "",
      updatedAt: null,
    };
  }

  function parseStoredSchedule(stored) {
    const base = getScheduleDefaults();
    const storedMode = normalizeMode(stored?.mode);
    const storedTipo = normalizeType(stored?.tipo);

    return {
      ...base,
      ...stored,
      _id: SCHEDULE_DOC_ID,
      active: stored?.active === true,
      mode: storedMode,
      tipo: storedTipo,
      time: parseTime(stored?.time)?.raw || "",
      colecciones: Array.isArray(stored?.colecciones)
        ? Array.from(new Set(stored.colecciones.map((nombre) => sanitizeText(nombre)).filter(Boolean)))
        : [],
    };
  }

  function toClientSchedule(stored) {
    return {
      active: Boolean(stored.active),
      mode: stored.mode,
      tipo: stored.tipo,
      time: stored.time || "",
      colecciones: stored.colecciones || [],
      nextRunAt: stored.nextRunAt || "",
      lastRunAt: stored.lastRunAt || "",
      lastError: stored.lastError || "",
      updatedBy: stored.updatedBy || "",
      updatedAt: stored.updatedAt || "",
    };
  }

  function getScheduleCollection() {
    return mongoose.connection.db.collection(SCHEDULE_COLLECTION);
  }

  function clearScheduleTimer() {
    if (scheduleTimer) {
      global.clearTimeout(scheduleTimer);
      scheduleTimer = null;
    }
  }

  function computeDelayMs(state, now = new Date()) {
    const parsed = parseTime(state.time);
    if (!parsed) return 3600 * 1000;

    const next = new Date(now.getTime());
    next.setHours(parsed.hour, parsed.minute, parsed.second, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return Math.max(DELAY_MIN_MS, next.getTime() - now.getTime());
  }

  function buildBackupSizeZipLike(resumen, respaldo) {
    return {
      ...resumen,
      tamanoZipBytes: Buffer.byteLength(JSON.stringify(respaldo, null, 2), "utf8"),
    };
  }

  function buildBackupFileName(resumen) {
    const typeKey = String(resumen.tipo || "").toLowerCase().includes("colecciones")
      ? "colecciones"
      : "completo";
    const stamp = new Date(resumen.fecha || Date.now()).toISOString().replace(/[:.]/g, "-");
    return `respaldo-${typeKey}-${stamp}-${sanitizeText(resumen.id || "sin-id")}.json`;
  }

  function addDownloadMetadata(summary) {
    const backupInfo = backupArtifacts.get(summary.id);
    if (!backupInfo) return summary;
    return {
      ...summary,
      downloadAvailable: true,
      downloadFileName: backupInfo.fileName,
      downloadSizeBytes: Number(backupInfo.sizeBytes || 0),
    };
  }

  async function ensureBackupDir() {
    await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
  }

  function pruneBackupArtifacts() {
    if (backupArtifacts.size <= MAX_SAVED_FILES) return;
    const ordered = [...backupArtifacts.values()]
      .filter((entry) => entry.createdAt)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const overflow = Math.max(0, ordered.length - MAX_SAVED_FILES);
    const toDelete = ordered.slice(0, overflow);

    for (const entry of toDelete) {
      backupArtifacts.delete(entry.id);
      fs.promises.unlink(entry.path).catch(() => {});
    }
  }

  function extractBackupIdFromFileName(fileName) {
    const marker = "-rsp-";
    const markerIndex = fileName.indexOf(marker);
    if (markerIndex < 0) return "";
    return fileName.replace(/\.json$/i, "").slice(markerIndex + 1);
  }

  async function getPersistedBackupHistory() {
    await ensureBackupDir();
    const entries = await fs.promises.readdir(BACKUP_DIR, { withFileTypes: true }).catch(() => []);
    const files = entries
      .filter((entry) => entry.isFile())
      .filter((entry) => entry.name.startsWith("respaldo-") && entry.name.includes("-rsp-") && /\.json$/i.test(entry.name));

    const history = [];
    for (const file of files) {
      const fileName = file.name;
      const backupId = extractBackupIdFromFileName(fileName);
      if (!backupId) continue;

      const filePath = path.join(BACKUP_DIR, fileName);
      const [stats, content] = await Promise.all([
        fs.promises.stat(filePath).catch(() => null),
        fs.promises.readFile(filePath, "utf8").catch(() => null),
      ]);
      if (!stats || !content) continue;

      let metadata = {};
      try {
        const parsed = JSON.parse(content);
        metadata = parsed?.metadata || {};
      } catch (_error) {
        metadata = {};
      }

      const tipoFromFile = /^respaldo-colecciones-/i.test(fileName) ? "Por colecciones" : "Completo";
      const fecha =
        metadata.fechaRespaldo ||
        metadata.fecha ||
        metadata?.metadata?.fechaRespaldo ||
        new Date(stats.mtimeMs).toISOString();

      history.push({
        id: backupId,
        fecha,
        tipo: metadata.tipo || tipoFromFile,
        colecciones: Array.isArray(metadata.colecciones) ? metadata.colecciones : [],
        totalColecciones:
          metadata.totalColecciones || (Array.isArray(metadata.colecciones) ? metadata.colecciones.length : 0),
        totalDocumentos: metadata.totalDocumentos || 0,
        tamanoBytes: Number(stats.size || 0),
        tamanoZipBytes: Number(stats.size || 0),
        estado: "Completado",
        downloadAvailable: true,
        downloadFileName: fileName,
        downloadSizeBytes: Number(stats.size || 0),
        updatedBy: metadata.sistema ? "sistema" : "",
      });
    }

    return history
      .filter((entry) => entry.id)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, MAX_HISTORY);
  }

  async function findBackupOnDiskById(backupId) {
    if (!backupId) return null;

    await ensureBackupDir();
    const entries = await fs.promises.readdir(BACKUP_DIR, { withFileTypes: true }).catch(() => []);
    const backupFile = entries
      .filter((entry) => entry.isFile())
      .filter((entry) => {
        if (!entry.name.toLowerCase().endsWith(".json")) return false;
        const normalized = entry.name.toLowerCase();
        const normalizedId = backupId.toLowerCase();
        return normalized === `${normalizedId}.json` ||
          normalized.endsWith(`-${normalizedId}.json`);
      })
      .find((entry) => !/\.(tmp|temp)$/i.test(entry.name));

    if (!backupFile) return null;

    const filePath = path.join(BACKUP_DIR, backupFile.name);
    const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
    if (!content) return null;

    const createdAt = (() => {
      try {
        const parsed = JSON.parse(content);
        return parsed?.metadata?.fechaRespaldo || new Date().toISOString();
      } catch (_error) {
        return new Date().toISOString();
      }
    })();

    return {
      id: backupId,
      fileName: backupFile.name,
      path: filePath,
      sizeBytes: Buffer.byteLength(content, "utf8"),
      createdAt,
    };
  }

  async function persistBackupArtifact(summary, respaldo) {
    await ensureBackupDir();
    const fileName = buildBackupFileName(summary);
    const filePath = path.join(BACKUP_DIR, fileName);
    const content = JSON.stringify(respaldo, null, 2);
    await fs.promises.writeFile(filePath, content, "utf8");
    const metadata = {
      id: summary.id,
      fileName,
      path: filePath,
      sizeBytes: Buffer.byteLength(content, "utf8"),
      createdAt: summary.fecha || new Date().toISOString(),
    };
    backupArtifacts.set(summary.id, metadata);
    pruneBackupArtifacts();
    return metadata;
  }

  function pushHistory(summary, respaldo) {
    const resumenConZip = buildBackupSizeZipLike(summary, respaldo);
    const summaryWithZip = addDownloadMetadata(resumenConZip);
    guardarResumenEnHistorial(summaryWithZip);
    if (historialRespaldos.length > MAX_HISTORY) {
      historialRespaldos.length = MAX_HISTORY;
    }
    return summaryWithZip;
  }

  async function getStoredSchedule() {
    const collection = getScheduleCollection();
    const stored = await collection.findOne({ _id: SCHEDULE_DOC_ID });
    return parseStoredSchedule(stored || null);
  }

  async function saveStoredSchedule(patch) {
    const collection = getScheduleCollection();
    const payload = {
      ...patch,
      _id: SCHEDULE_DOC_ID,
      updatedAt: new Date().toISOString(),
    };
    await collection.updateOne(
      { _id: SCHEDULE_DOC_ID },
      { $set: payload },
      { upsert: true }
    );
  }

  async function getAvailableCollectionNames() {
    return obtenerNombresColeccionesDisponibles();
  }

  async function resolveCollections(tipo, coleccionesSolicitadas = []) {
    const all = await getAvailableCollectionNames();
    const availableSet = new Set(all);

    if (tipo === "completo") {
      return [...all].sort((a, b) => a.localeCompare(b, "es"));
    }

    const normalized = Array.isArray(coleccionesSolicitadas)
      ? Array.from(new Set(coleccionesSolicitadas.map((nombre) => sanitizeText(nombre)).filter(Boolean)))
      : [];

    const invalidas = normalized.filter((nombre) => !availableSet.has(nombre));
    if (invalidas.length > 0) {
      throw new Error(`Colecciones invalidas: ${invalidas.join(", ")}`);
    }
    if (normalized.length === 0) {
      throw new Error("Debes seleccionar al menos una coleccion.");
    }
    return normalized.sort((a, b) => a.localeCompare(b, "es"));
  }

  async function createBackup(tipo, coleccionesSolicitadas = []) {
    const normalizedType = normalizeType(tipo);
    const coleccionesRespaldo = await resolveCollections(normalizedType, coleccionesSolicitadas);
    const db = mongoose.connection.db;

    const datos = {};
    let totalDocumentos = 0;

    for (const nombreColeccion of coleccionesRespaldo) {
      const documentos = await db.collection(nombreColeccion).find({}).toArray();
      datos[nombreColeccion] = documentos;
      totalDocumentos += documentos.length;
    }

    const fechaRespaldo = new Date().toISOString();
    const descripcionTipo = normalizedType === "completo" ? "Completo" : "Por colecciones";

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

    return { resumen, respaldo };
  }

  function scheduleNextExecution() {
    clearScheduleTimer();

    if (!scheduleConfig || !scheduleConfig.active) {
      return;
    }

    const delay = computeDelayMs(scheduleConfig);
    const nextRunAt = new Date(Date.now() + delay).toISOString();
    scheduleConfig.nextRunAt = nextRunAt;
    saveStoredSchedule(scheduleConfig).catch(() => {});

    scheduleTimer = global.setTimeout(async () => {
      if (!scheduleConfig || !scheduleConfig.active || isRunningAutomatic) return;
      isRunningAutomatic = true;

      try {
        const collectionsToUse =
          scheduleConfig.tipo === "colecciones" ? scheduleConfig.colecciones : [];
        const { resumen, respaldo } = await createBackup(scheduleConfig.tipo, collectionsToUse);
        const resumenConOrigen = {
          ...resumen,
          updatedBy: "sistema",
        };
        await persistBackupArtifact(resumenConOrigen, respaldo).catch((error) => {
          console.error("No fue posible guardar respaldo automatico en disco:", error);
        });
        const summaryWithZip = pushHistory(resumenConOrigen, respaldo);

        scheduleConfig.lastRunAt = summaryWithZip.fecha;
        scheduleConfig.lastError = "";
        scheduleConfig.updatedBy = "sistema";
        scheduleConfig.nextRunAt = new Date(Date.now() + computeDelayMs(scheduleConfig)).toISOString();
        await saveStoredSchedule(scheduleConfig);
      } catch (error) {
        scheduleConfig.lastError = error?.message || "No fue posible ejecutar respaldo automatico.";
        scheduleConfig.updatedBy = "sistema";
        await saveStoredSchedule(scheduleConfig).catch(() => {});
        console.error("Error en respaldo automatico:", error);
      } finally {
        isRunningAutomatic = false;
        scheduleNextExecution();
      }
    }, delay);
  }

  async function bootstrapSchedule() {
    if (bootstrapLoading) return;
    bootstrapLoading = true;
    try {
      scheduleConfig = await getStoredSchedule();
      if (!scheduleConfig) {
        scheduleConfig = getScheduleDefaults();
        await saveStoredSchedule(scheduleConfig);
      }
      if (scheduleConfig.active) {
        scheduleNextExecution();
      }
    } catch (_error) {
      scheduleConfig = getScheduleDefaults();
    } finally {
      bootstrapLoading = false;
    }
  }

  async function ensureSchedulerReady() {
    if (mongoose.connection.readyState === 1) {
      await bootstrapSchedule();
    } else {
      mongoose.connection.once("connected", async () => {
        try {
          await bootstrapSchedule();
        } catch (_error) {
          // Keep running; schedule state may be unavailable temporarily.
        }
      });
    }
  }

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
    const memoria = Array.isArray(historialRespaldos) ? historialRespaldos : [];
    const historicos = new Map();

    memoria.forEach((entry) => {
      if (entry?.id) {
        historicos.set(entry.id, entry);
      }
    });

    const persistidos = await getPersistedBackupHistory().catch(() => []);
    for (const entry of persistidos) {
      if (entry?.id && !historicos.has(entry.id)) {
        historicos.set(entry.id, {
          ...entry,
          downloadAvailable: true,
        });
      }
    }

    const historialCombinado = Array.from(historicos.values())
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, MAX_HISTORY);

    historialRespaldos.length = 0;
    for (const entry of historialCombinado) {
      historialRespaldos.push(entry);
    }

    return res.json({ historial: historialCombinado });
  });

  router.get("/respaldos/descargar/:id", async (req, res) => {
    const backupId = sanitizeText(req.params.id || "");
    let backupInfo = backupArtifacts.get(backupId);
    if (!backupInfo) {
      backupInfo = await findBackupOnDiskById(backupId);
      if (backupInfo) {
        backupArtifacts.set(backupId, {
          ...backupInfo,
          createdAt: String(backupInfo.createdAt || new Date().toISOString()),
        });
      }
    }

    if (!backupInfo) {
      return res.status(404).json({ errors: ["Respaldo no encontrado."] });
    }

    try {
      await fs.promises.access(backupInfo.path, fs.constants.F_OK);
    } catch (_error) {
      backupArtifacts.delete(backupId);
      return res.status(404).json({ errors: ["Respaldo no disponible en disco."] });
    }

    try {
      return res.download(backupInfo.path, backupInfo.fileName);
    } catch (_error) {
      return res.status(500).json({ errors: ["No fue posible descargar el respaldo."] });
    }
  });

  router.get("/respaldos/programacion", async (_req, res) => {
    try {
      scheduleConfig = await getStoredSchedule();
    } catch (_error) {
      scheduleConfig = getScheduleDefaults();
    }
    return res.json({ programacion: toClientSchedule(scheduleConfig || getScheduleDefaults()) });
  });

  router.put("/respaldos/programacion", async (req, res) => {
    const input = req.body || {};
    const mode = "time";
    const tipo = normalizeType(input.tipo);
    const timeParsed = parseTime(input.time || "");
    const active = input.active !== false;
    const rawCollections = Array.isArray(input.colecciones) ? input.colecciones : [];

    const errors = [];

    if (!["completo", "colecciones"].includes(tipo)) {
      errors.push("Tipo invalido. Usa 'completo' o 'colecciones'.");
    }
    if (mode === "time" && !timeParsed) {
      errors.push("Hora invalida. Usa HH:MM o HH:MM:SS.");
    }
    if (tipo === "colecciones" && rawCollections.length === 0) {
      errors.push("Debes seleccionar al menos una coleccion.");
    }

    if (errors.length) {
      return res.status(400).json({ errors });
    }

    let colecciones = [];
    if (tipo === "colecciones") {
      try {
        colecciones = await resolveCollections(tipo, rawCollections);
      } catch (error) {
        return res.status(400).json({ errors: [error?.message || "No fue posible validar colecciones."] });
      }
    }

    const nextConfig = {
      ...(scheduleConfig || getScheduleDefaults()),
      active,
      mode,
      tipo,
      time: mode === "time" ? timeParsed.raw : "",
      colecciones,
      lastError: "",
      updatedBy: sanitizeText(req.admin?.username || req.admin?.correo || ""),
    };

    scheduleConfig = parseStoredSchedule(nextConfig);
    await saveStoredSchedule(scheduleConfig);

    if (active) {
      scheduleNextExecution();
    } else {
      clearScheduleTimer();
    }

    return res.json({ programacion: toClientSchedule(scheduleConfig) });
  });

  router.post("/respaldos/crear", async (req, res) => {
    const tipo = normalizeType(req.body?.tipo);
    const coleccionesSolicitadas = Array.isArray(req.body?.colecciones)
      ? req.body.colecciones.map((nombre) => sanitizeText(nombre)).filter(Boolean)
      : [];

    try {
      const { resumen, respaldo } = await createBackup(tipo, coleccionesSolicitadas);
      const resumenConOrigen = {
        ...resumen,
        updatedBy: "admin",
      };
      await persistBackupArtifact(resumenConOrigen, respaldo).catch((error) => {
        console.error("No fue posible guardar respaldo manual en disco:", error);
      });
      const summary = pushHistory(resumenConOrigen, respaldo);
      return res.json({ resumen: summary, respaldo });
    } catch (error) {
      return res.status(400).json({ errors: [error?.message || "No fue posible generar el respaldo."] });
    }
  });

  ensureSchedulerReady().catch(() => {});
}

module.exports = registrarRespaldosAdminRoutes;
