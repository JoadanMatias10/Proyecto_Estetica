const SNAPSHOT_REFRESH_MS = 15000;
const SNAPSHOT_CACHE_TTL_MS = 10000;
const RECENT_ACTIVITY_WINDOW_MS = 30000;
const RECENT_ACTIVITY_CACHE_TTL_MS = 1000;
const LOW_STOCK_THRESHOLD = 5;
const MAX_ACTIVITY_RECORDS = 12;
const ACTIVITY_COLLECTIONS = ["productos", "servicios", "categorias_servicio", "citas", "movimientos_inventario", "ventas"];
const STREAM_ENABLED = String(process.env.ADMIN_DB_MONITOR_STREAM_ENABLED || "").trim().toLowerCase() === "true";
const {
  summarizeRecentOperations,
  summarizeAccumulatedOperations,
} = require("../../utils/recentOperationTracker");
const { buildServiceSegmentFilter, SERVICE_SEGMENTS } = require("../../utils/serviceSegments");

const CONNECTION_STATUS_LABELS = {
  0: "Desconectada",
  1: "Conectada",
  2: "Conectando",
  3: "Desconectando",
};

let telemetryBaseline = null;
let telemetryAccumulatedBaseline = null;

function registrarMonitorAdminRoutes(router, contexto) {
  const {
    mongoose,
    Product,
    Service,
    ServiceCategory,
    Appointment,
    Sale,
    InventoryMovement,
  } = contexto;

  const cache = new Map();
  const inflight = new Map();
  const activityConfigs = [
    {
      key: "productos",
      model: Product,
      limit: 3,
      sort: { updatedAt: -1, createdAt: -1 },
      select: "nombre stock categoria createdAt updatedAt",
      map: (doc) => ({
        id: `productos:${String(doc._id)}`,
        coleccion: "productos",
        titulo: `Producto ${doc.nombre || "sin nombre"}`,
        descripcion: `Stock actual: ${Number(doc.stock || 0)} | Categoria: ${doc.categoria || "Sin categoria"}`,
        principal: doc.nombre || "Sin nombre",
        datoClave: `Stock: ${Number(doc.stock || 0)}`,
        actor: "Admin",
        fecha: doc.updatedAt || doc.createdAt || null,
      }),
    },
    {
      key: "servicios",
      model: Service,
      limit: 3,
      sort: { updatedAt: -1, createdAt: -1 },
      select: "nombre segmento subcategoria precio tiempo createdAt updatedAt",
      map: (doc) => ({
        id: `servicios:${String(doc._id)}`,
        coleccion: "servicios",
        titulo: `Servicio ${doc.nombre || "sin nombre"}`,
        descripcion: `Segmento: ${doc.segmento || "Sin segmento"} | Subcategoria: ${doc.subcategoria || "Sin subcategoria"}`,
        principal: doc.nombre || "Sin nombre",
        datoClave: `Precio: ${Number(doc.precio || 0)}`,
        actor: "Admin",
        fecha: doc.updatedAt || doc.createdAt || null,
      }),
    },
    {
      key: "categorias_servicio",
      model: ServiceCategory,
      limit: 3,
      sort: { updatedAt: -1, createdAt: -1 },
      select: "nombre segmento estado descripcion createdAt updatedAt",
      map: (doc) => ({
        id: `categorias_servicio:${String(doc._id)}`,
        coleccion: "categorias_servicio",
        titulo: `Categoria ${doc.nombre || "sin nombre"}`,
        descripcion: `Segmento: ${doc.segmento || "Sin segmento"} | Estado: ${doc.estado || "Sin estado"}`,
        principal: doc.nombre || "Sin nombre",
        datoClave: doc.estado || "Sin estado",
        actor: "Admin",
        fecha: doc.updatedAt || doc.createdAt || null,
      }),
    },
    {
      key: "citas",
      model: Appointment,
      limit: 3,
      sort: { updatedAt: -1, createdAt: -1 },
      select: "servicio estado fechaHora createdAt updatedAt",
      map: (doc) => ({
        id: `citas:${String(doc._id)}`,
        coleccion: "citas",
        titulo: `Cita de ${doc.servicio || "servicio"}`,
        descripcion: `Estado: ${doc.estado || "programada"} | Fecha: ${toIso(doc.fechaHora) || "sin fecha"}`,
        principal: doc.servicio || "Servicio",
        datoClave: `Estado: ${doc.estado || "programada"}`,
        actor: "Cliente",
        fecha: doc.updatedAt || doc.createdAt || doc.fechaHora || null,
      }),
    },
    {
      key: "movimientos_inventario",
      model: InventoryMovement,
      limit: 3,
      sort: { createdAt: -1 },
      select: "producto accion cantidad usuario stockActual createdAt updatedAt",
      map: (doc) => ({
        id: `movimientos:${String(doc._id)}`,
        coleccion: "movimientos_inventario",
        titulo: `${doc.accion || "Movimiento"} en ${doc.producto || "producto"}`,
        descripcion: `Cantidad: ${Number(doc.cantidad || 0)} | Stock actual: ${Number(doc.stockActual || 0)}`,
        principal: `${doc.accion || "Movimiento"} en ${doc.producto || "producto"}`,
        datoClave: `Cantidad: ${Number(doc.cantidad || 0)}`,
        actor: doc.usuario || "Admin",
        fecha: doc.createdAt || doc.updatedAt || null,
      }),
    },
    {
      key: "ventas",
      model: Sale,
      limit: 3,
      sort: { createdAt: -1 },
      select: "cliente usuario total createdAt updatedAt",
      map: (doc) => ({
        id: `ventas:${String(doc._id)}`,
        coleccion: "ventas",
        titulo: `Venta a ${doc.cliente || "Mostrador"}`,
        descripcion: `Total: ${Number(doc.total || 0)} | Usuario: ${doc.usuario || "Admin"}`,
        principal: `Venta a ${doc.cliente || "Mostrador"}`,
        datoClave: `Total: ${Number(doc.total || 0)}`,
        actor: doc.usuario || "Admin",
        fecha: doc.createdAt || doc.updatedAt || null,
      }),
    },
  ];

  function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function getStartOfDay(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function getEndOfDay(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  function toDate(value) {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  function toIso(value) {
    const parsed = toDate(value);
    return parsed ? parsed.toISOString() : "";
  }

  function bytesToKb(value) {
    return Number((safeNumber(value) / 1024).toFixed(2));
  }

  function bytesToMb(value) {
    return Number((safeNumber(value) / (1024 * 1024)).toFixed(2));
  }

  function calculatePercent(part, total) {
    const safePart = safeNumber(part);
    const safeTotal = safeNumber(total);
    if (safeTotal <= 0) return 0;
    return Number(((safePart / safeTotal) * 100).toFixed(2));
  }

  function formatConnectionState() {
    return CONNECTION_STATUS_LABELS[mongoose.connection.readyState] || "Estado desconocido";
  }

  async function runAdminCommand(command) {
    if (!mongoose.connection?.db || mongoose.connection.readyState !== 1) return null;
    try {
      return await mongoose.connection.db.admin().command(command);
    } catch (_error) {
      return null;
    }
  }

  async function getDbStats() {
    if (!mongoose.connection?.db || mongoose.connection.readyState !== 1) return null;
    return mongoose.connection.db.stats().catch(() => null);
  }

  async function getCollectionCount(stats) {
    if (stats?.collections) return safeNumber(stats.collections);
    if (!mongoose.connection?.db || mongoose.connection.readyState !== 1) return 0;
    const collections = await mongoose.connection.db
      .listCollections({}, { nameOnly: true })
      .toArray()
      .catch(() => []);
    return Array.isArray(collections) ? collections.length : 0;
  }

  async function getPingMs() {
    if (!mongoose.connection?.db || mongoose.connection.readyState !== 1) return null;
    const start = Date.now();
    const ping = await runAdminCommand({ ping: 1 });
    if (!ping) return null;
    return Math.max(Date.now() - start, 0);
  }

  function buildOperations(opcounters) {
    const operations = {
      insert: safeNumber(opcounters?.insert),
      query: safeNumber(opcounters?.query),
      update: safeNumber(opcounters?.update),
      delete: safeNumber(opcounters?.delete),
      getmore: safeNumber(opcounters?.getmore),
      command: safeNumber(opcounters?.command),
    };
    return {
      ...operations,
      total: Object.values(operations).reduce((sum, value) => sum + value, 0),
    };
  }

  function buildEmptyOperations() {
    return {
      insert: 0,
      query: 0,
      update: 0,
      delete: 0,
      getmore: 0,
      command: 0,
      total: 0,
    };
  }

  function buildConnections(raw) {
    const current = safeNumber(raw?.current);
    const available = safeNumber(raw?.available);
    const totalCapacity = current + available;
    return {
      current,
      available,
      totalCapacity,
      totalCreated: safeNumber(raw?.totalCreated),
      rejected: safeNumber(raw?.rejected),
      utilizationPct: calculatePercent(current, totalCapacity),
    };
  }

  function buildNetwork(raw) {
    return {
      requests: safeNumber(raw?.numRequests),
      bytesInKb: bytesToKb(raw?.bytesIn),
      bytesOutKb: bytesToKb(raw?.bytesOut),
      physicalBytesInKb: bytesToKb(raw?.physicalBytesIn),
      physicalBytesOutKb: bytesToKb(raw?.physicalBytesOut),
    };
  }

  function buildCache(serverStatus) {
    const cacheStats = serverStatus?.wiredTiger?.cache || {};
    const usedBytes = safeNumber(cacheStats["bytes currently in the cache"]);
    const maxBytes = safeNumber(cacheStats["maximum bytes configured"]);
    const dirtyBytes = safeNumber(cacheStats["tracked dirty bytes in the cache"]);

    return {
      available: maxBytes > 0,
      usedMb: bytesToMb(usedBytes),
      maxMb: bytesToMb(maxBytes),
      dirtyMb: bytesToMb(dirtyBytes),
      usedPct: calculatePercent(usedBytes, maxBytes),
      dirtyPct: calculatePercent(dirtyBytes, maxBytes),
      ttlMs: SNAPSHOT_CACHE_TTL_MS,
      refreshMs: SNAPSHOT_REFRESH_MS,
    };
  }

  function buildWindow(nowMs, operations, requestsTotal) {
    const current = {
      nowMs,
      operations: {
        insert: safeNumber(operations?.insert),
        query: safeNumber(operations?.query),
        update: safeNumber(operations?.update),
        delete: safeNumber(operations?.delete),
        getmore: safeNumber(operations?.getmore),
        command: safeNumber(operations?.command),
        total: safeNumber(operations?.total),
      },
      requestsTotal: safeNumber(requestsTotal),
    };

    if (!telemetryBaseline || nowMs <= telemetryBaseline.nowMs) {
      telemetryBaseline = current;
      return {
        intervalMs: 0,
        operations: 0,
        operationsByType: buildEmptyOperations(),
        requests: 0,
        opsPerSec: 0,
        requestsPerSec: 0,
      };
    }

    const intervalMs = nowMs - telemetryBaseline.nowMs;
    const operationsByType = {
      insert: Math.max(current.operations.insert - telemetryBaseline.operations.insert, 0),
      query: Math.max(current.operations.query - telemetryBaseline.operations.query, 0),
      update: Math.max(current.operations.update - telemetryBaseline.operations.update, 0),
      delete: Math.max(current.operations.delete - telemetryBaseline.operations.delete, 0),
      getmore: Math.max(current.operations.getmore - telemetryBaseline.operations.getmore, 0),
      command: Math.max(current.operations.command - telemetryBaseline.operations.command, 0),
    };
    const operationsTotal = Object.values(operationsByType).reduce((sum, value) => sum + value, 0);
    const requests = Math.max(current.requestsTotal - telemetryBaseline.requestsTotal, 0);
    telemetryBaseline = current;

    return {
      intervalMs,
      operations: operationsTotal,
      operationsByType: {
        ...operationsByType,
        total: operationsTotal,
      },
      requests,
      opsPerSec: intervalMs > 0 ? Number(((operationsTotal * 1000) / intervalMs).toFixed(2)) : 0,
      requestsPerSec: intervalMs > 0 ? Number(((requests * 1000) / intervalMs).toFixed(2)) : 0,
    };
  }

  function buildAccumulatedMongoOperations(nowMs, operations) {
    const current = {
      nowMs,
      operations: {
        insert: safeNumber(operations?.insert),
        query: safeNumber(operations?.query),
        update: safeNumber(operations?.update),
        delete: safeNumber(operations?.delete),
        getmore: safeNumber(operations?.getmore),
        command: safeNumber(operations?.command),
        total: safeNumber(operations?.total),
      },
    };

    if (!telemetryAccumulatedBaseline || nowMs < telemetryAccumulatedBaseline.nowMs) {
      telemetryAccumulatedBaseline = current;
      return {
        ...buildEmptyOperations(),
        intervalMs: 0,
      };
    }

    return {
      insert: Math.max(current.operations.insert - telemetryAccumulatedBaseline.operations.insert, 0),
      query: Math.max(current.operations.query - telemetryAccumulatedBaseline.operations.query, 0),
      update: Math.max(current.operations.update - telemetryAccumulatedBaseline.operations.update, 0),
      delete: Math.max(current.operations.delete - telemetryAccumulatedBaseline.operations.delete, 0),
      getmore: Math.max(current.operations.getmore - telemetryAccumulatedBaseline.operations.getmore, 0),
      command: Math.max(current.operations.command - telemetryAccumulatedBaseline.operations.command, 0),
      total: Math.max(current.operations.total - telemetryAccumulatedBaseline.operations.total, 0),
      intervalMs: Math.max(nowMs - telemetryAccumulatedBaseline.nowMs, 0),
    };
  }

  async function countDocumentsSafe(model, filter) {
    try {
      return await model.countDocuments(filter);
    } catch (_error) {
      return 0;
    }
  }

  async function buildRecentCollectionOperations(now = new Date()) {
    const windowStart = new Date(now.getTime() - RECENT_ACTIVITY_WINDOW_MS);
    const trackedOperations = summarizeRecentOperations(RECENT_ACTIVITY_WINDOW_MS, ACTIVITY_COLLECTIONS);

    const perCollection = await Promise.all(
      activityConfigs.map(async (config) => {
        const [insertCount, updateCount] = await Promise.all([
          countDocumentsSafe(config.model, {
            createdAt: { $gte: windowStart, $lte: now },
          }),
          countDocumentsSafe(config.model, {
            updatedAt: { $gte: windowStart, $lte: now },
            $expr: { $gt: ["$updatedAt", "$createdAt"] },
          }),
        ]);

        return { insertCount, updateCount };
      })
    );

    const insertFromCollections = perCollection.reduce((sum, item) => sum + safeNumber(item.insertCount), 0);
    const updateFromCollections = perCollection.reduce((sum, item) => sum + safeNumber(item.updateCount), 0);
    const insert = Math.max(insertFromCollections, safeNumber(trackedOperations.insert));
    const update = Math.max(updateFromCollections, safeNumber(trackedOperations.update));
    const deleteCount = safeNumber(trackedOperations.delete);

    return {
      insert,
      query: 0,
      update,
      delete: deleteCount,
      getmore: 0,
      command: 0,
      total: insert + update + deleteCount,
      intervalMs: RECENT_ACTIVITY_WINDOW_MS,
      desde: windowStart.toISOString(),
      hasta: now.toISOString(),
    };
  }

  async function getCachedValue(cacheKey, builder, ttlMs = SNAPSHOT_CACHE_TTL_MS) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    if (inflight.has(cacheKey)) {
      return inflight.get(cacheKey);
    }

    const promise = builder()
      .then((value) => {
        cache.set(cacheKey, {
          value,
          expiresAt: Date.now() + ttlMs,
        });
        return value;
      })
      .finally(() => {
        inflight.delete(cacheKey);
      });

    inflight.set(cacheKey, promise);
    return promise;
  }

  async function buildTelemetry() {
    const now = new Date();
    const [stats, serverStatus, buildInfo, pingMs] = await Promise.all([
      getDbStats(),
      runAdminCommand({ serverStatus: 1 }),
      runAdminCommand({ buildInfo: 1 }),
      getPingMs(),
    ]);

    const operations = buildOperations(serverStatus?.opcounters);
    const connections = buildConnections(serverStatus?.connections);
    const network = buildNetwork(serverStatus?.network);
    const cacheStats = buildCache(serverStatus);
    const baseDatos = {
      totalColecciones: await getCollectionCount(stats),
      totalDocumentosAprox: safeNumber(stats?.objects),
      tamanoDatosMb: bytesToMb(stats?.dataSize),
      tamanoAlmacenamientoMb: bytesToMb(stats?.storageSize),
      tamanoIndicesMb: bytesToMb(stats?.indexSize),
      totalIndices: safeNumber(stats?.indexes),
    };

    const windowStats = buildWindow(now.getTime(), operations, network.requests);
    const accumulatedMongoOperations = buildAccumulatedMongoOperations(now.getTime(), operations);

    return {
      generadoEn: now.toISOString(),
      refreshIntervalMs: SNAPSHOT_REFRESH_MS,
      estadoConexion: formatConnectionState(),
      readyState: mongoose.connection.readyState,
      nombreBaseDatos:
        mongoose.connection?.db?.databaseName ||
        mongoose.connection?.name ||
        process.env.MONGODB_DB_NAME ||
        "",
      versionMongo: serverStatus?.version || buildInfo?.version || "",
      motorAlmacenamiento: serverStatus?.storageEngine?.name || "",
      host: mongoose.connection.host || "",
      port: mongoose.connection.port || "",
      uptimeSegundos: safeNumber(serverStatus?.uptime),
      latenciaMs: pingMs,
      baseDatos,
      conexiones: connections,
      operaciones: operations,
      operacionesMongoRecientes: windowStats.operationsByType,
      operacionesMongoAcumuladas: accumulatedMongoOperations,
      red: network,
      cache: cacheStats,
      ventana: {
        intervalMs: windowStats.intervalMs,
        operations: windowStats.operations,
        requests: windowStats.requests,
        opsPerSec: windowStats.opsPerSec,
        requestsPerSec: windowStats.requestsPerSec,
      },
      stream: {
        habilitado: STREAM_ENABLED,
        coleccionesObjetivo: ACTIVITY_COLLECTIONS,
      },
      disponible: {
        serverStatus: Boolean(serverStatus),
        buildInfo: Boolean(buildInfo),
      },
    };
  }

  async function buildSummary() {
    const [telemetry, recentCollectionOperations] = await Promise.all([
      getCachedValue("telemetry", buildTelemetry),
      getCachedValue(
        "recentCollectionOperations",
        () => buildRecentCollectionOperations(),
        RECENT_ACTIVITY_CACHE_TTL_MS
      ),
    ]);
    const accumulatedCollectionOperations = summarizeAccumulatedOperations(ACTIVITY_COLLECTIONS);
    const accumulatedOperations = {
      insert: accumulatedCollectionOperations.insert,
      query: safeNumber(telemetry?.operacionesMongoAcumuladas?.query),
      update: accumulatedCollectionOperations.update,
      delete: accumulatedCollectionOperations.delete,
      getmore: 0,
      command: 0,
      total:
        accumulatedCollectionOperations.insert +
        safeNumber(telemetry?.operacionesMongoAcumuladas?.query) +
        accumulatedCollectionOperations.update +
        accumulatedCollectionOperations.delete,
      intervalMs: Math.max(
        accumulatedCollectionOperations.intervalMs,
        safeNumber(telemetry?.operacionesMongoAcumuladas?.intervalMs)
      ),
      desde: accumulatedCollectionOperations.desde,
      hasta: telemetry.generadoEn,
    };
    return {
      generadoEn: telemetry.generadoEn,
      refreshIntervalMs: telemetry.refreshIntervalMs,
      estadoConexion: telemetry.estadoConexion,
      readyState: telemetry.readyState,
      nombreBaseDatos: telemetry.nombreBaseDatos,
      versionMongo: telemetry.versionMongo,
      motorAlmacenamiento: telemetry.motorAlmacenamiento,
      latenciaMs: telemetry.latenciaMs,
      baseDatos: telemetry.baseDatos,
      conexiones: telemetry.conexiones,
      operaciones: telemetry.operaciones,
      operacionesMongoRecientes: telemetry.operacionesMongoRecientes,
      operacionesAcumuladas: accumulatedOperations,
      operacionesRecientes: recentCollectionOperations,
      red: telemetry.red,
      cache: telemetry.cache,
      ventana: telemetry.ventana,
      stream: telemetry.stream,
      disponible: telemetry.disponible,
    };
  }

  async function buildActivity() {
    const now = new Date();
    const groups = await Promise.all(
      activityConfigs.map(async (config) => {
        const rows = await config.model
          .find()
          .sort(config.sort)
          .limit(config.limit)
          .select(config.select)
          .lean();

        return rows.map(config.map);
      })
    );

    const registros = groups
      .flat()
      .filter((item) => item?.fecha)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, MAX_ACTIVITY_RECORDS)
      .map((item) => ({
        ...item,
        fecha: toIso(item.fecha),
      }));

    return {
      generadoEn: now.toISOString(),
      maxRegistros: MAX_ACTIVITY_RECORDS,
      coleccionesMonitoreadas: ACTIVITY_COLLECTIONS,
      registros,
    };
  }

  async function buildHealth() {
    const [telemetry, recentCollectionOperations] = await Promise.all([
      getCachedValue("telemetry", buildTelemetry),
      getCachedValue(
        "recentCollectionOperations",
        () => buildRecentCollectionOperations(),
        RECENT_ACTIVITY_CACHE_TTL_MS
      ),
    ]);
    const accumulatedCollectionOperations = summarizeAccumulatedOperations(ACTIVITY_COLLECTIONS);
    const accumulatedOperations = {
      insert: accumulatedCollectionOperations.insert,
      query: safeNumber(telemetry?.operacionesMongoAcumuladas?.query),
      update: accumulatedCollectionOperations.update,
      delete: accumulatedCollectionOperations.delete,
      getmore: 0,
      command: 0,
      total:
        accumulatedCollectionOperations.insert +
        safeNumber(telemetry?.operacionesMongoAcumuladas?.query) +
        accumulatedCollectionOperations.update +
        accumulatedCollectionOperations.delete,
      intervalMs: Math.max(
        accumulatedCollectionOperations.intervalMs,
        safeNumber(telemetry?.operacionesMongoAcumuladas?.intervalMs)
      ),
      desde: accumulatedCollectionOperations.desde,
      hasta: telemetry.generadoEn,
    };

    return {
      ...telemetry,
      operacionesAcumuladas: accumulatedOperations,
      operacionesRecientes: recentCollectionOperations,
    };
  }

  function getWinningStage(node) {
    if (!node || typeof node !== "object") return "UNKNOWN";
    if (node.stage === "IXSCAN" || node.stage === "COLLSCAN") return node.stage;

    const nestedKeys = ["inputStage", "outerStage", "innerStage", "thenStage", "elseStage"];

    for (const key of nestedKeys) {
      if (node[key]) {
        const found = getWinningStage(node[key]);
        if (found && found !== "UNKNOWN") return found;
      }
    }

    if (Array.isArray(node.inputStages)) {
      for (const child of node.inputStages) {
        const found = getWinningStage(child);
        if (found && found !== "UNKNOWN") return found;
      }
    }

    if (Array.isArray(node.shards)) {
      for (const shard of node.shards) {
        const found = getWinningStage(shard?.winningPlan || shard?.executionStages || shard);
        if (found && found !== "UNKNOWN") return found;
      }
    }

    return node.stage || "UNKNOWN";
  }

  function interpretStage(stage) {
    if (stage === "IXSCAN") {
      return "IXSCAN: MongoDB esta usando un indice, lo cual normalmente es bueno para rendimiento.";
    }
    if (stage === "COLLSCAN") {
      return "COLLSCAN: MongoDB esta escaneando la coleccion completa. Conviene revisar indices.";
    }
    return `${stage}: revisar el plan para confirmar si la consulta es eficiente.`;
  }

  function buildExplainPayload(nombre, descripcion, queryLabel, explain) {
    const executionStats = explain?.executionStats || {};
    const executionStages =
      executionStats.executionStages ||
      explain?.queryPlanner?.winningPlan ||
      null;
    const stagePrincipal = getWinningStage(executionStages);

    return {
      generadoEn: new Date().toISOString(),
      consulta: nombre,
      descripcion,
      query: queryLabel,
      executionTimeMillis: safeNumber(executionStats.executionTimeMillis),
      totalDocsExamined: safeNumber(executionStats.totalDocsExamined),
      totalKeysExamined: safeNumber(executionStats.totalKeysExamined),
      nReturned: safeNumber(executionStats.nReturned),
      stagePrincipal,
      interpretacion: interpretStage(stagePrincipal),
    };
  }

  async function explainProducts() {
    const query = Product.find({ stock: { $lte: LOW_STOCK_THRESHOLD } })
      .sort({ stock: 1, nombre: 1 })
      .limit(10);
    const explain = await query.explain("executionStats");
    return buildExplainPayload(
      "products",
      "Consulta de productos con stock bajo.",
      `find({ stock: { $lte: ${LOW_STOCK_THRESHOLD} } }).sort({ stock: 1, nombre: 1 }).limit(10)`,
      explain
    );
  }

  async function explainCitas() {
    const startOfToday = getStartOfDay(new Date());
    const endOfToday = getEndOfDay(new Date());
    const query = Appointment.find({
      fechaHora: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    }).limit(10);
    const explain = await query.explain("executionStats");
    return buildExplainPayload(
      "citas",
      "Consulta de citas programadas para hoy.",
      "find({ fechaHora: { $gte: inicioHoy, $lte: finHoy } }).limit(10)",
      explain
    );
  }

  async function explainServices() {
    const segment = SERVICE_SEGMENTS[0];
    const query = Service.find(buildServiceSegmentFilter(segment)).limit(10);
    const explain = await query.explain("executionStats");
    return buildExplainPayload(
      "services",
      "Consulta de servicios filtrados por segmento.",
      `find({ segmento: { $in: ["${segment}", "Mujer"] } }).limit(10)`,
      explain
    );
  }

  router.get("/database-monitor", async (_req, res) => {
    const summary = await buildSummary();
    return res.json({
      deprecated: true,
      endpointSugerido: "/database-monitor/summary",
      ...summary,
    });
  });

  router.get("/database-monitor/summary", async (_req, res) => {
    const payload = await buildSummary();
    return res.json(payload);
  });

  router.get("/database-monitor/activity", async (_req, res) => {
    const payload = await getCachedValue("activity", buildActivity);
    return res.json(payload);
  });

  router.get("/database-monitor/health", async (_req, res) => {
    const payload = await buildHealth();
    return res.json(payload);
  });

  router.get("/database-monitor/explain/products", async (_req, res) => {
    const payload = await explainProducts();
    return res.json(payload);
  });

  router.get("/database-monitor/explain/citas", async (_req, res) => {
    const payload = await explainCitas();
    return res.json(payload);
  });

  router.get("/database-monitor/explain/services", async (_req, res) => {
    const payload = await explainServices();
    return res.json(payload);
  });

  router.get("/database-monitor/stream", async (req, res) => {
    if (!STREAM_ENABLED) {
      return res.status(503).json({
        habilitado: false,
        message: "El stream de monitoreo esta deshabilitado por defecto.",
        hint: "Activa ADMIN_DB_MONITOR_STREAM_ENABLED=true solo si realmente necesitas cambios en vivo.",
      });
    }

    if (!mongoose.connection?.db || mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        habilitado: false,
        message: "MongoDB no esta conectado para iniciar el stream.",
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const changeStream = mongoose.connection.db.watch(
      [
        {
          $match: {
            "ns.coll": { $in: ACTIVITY_COLLECTIONS },
          },
        },
      ],
      {
        fullDocument: "updateLookup",
      }
    );

    const writeEvent = (eventName, payload) => {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    writeEvent("status", {
      habilitado: true,
      colecciones: ACTIVITY_COLLECTIONS,
      generadoEn: new Date().toISOString(),
    });

    changeStream.on("change", (change) => {
      writeEvent("change", {
        operacion: change.operationType || "unknown",
        coleccion: String(change?.ns?.coll || ""),
        documentId: change?.documentKey?._id ? String(change.documentKey._id) : "",
        fecha: toIso(change?.wallTime || new Date()),
      });
    });

    changeStream.on("error", (error) => {
      writeEvent("error", {
        message: error?.message || "No fue posible mantener el stream.",
      });
      changeStream.close().catch(() => {});
      res.end();
    });

    req.on("close", () => {
      changeStream.close().catch(() => {});
    });
  });
}

module.exports = registrarMonitorAdminRoutes;
