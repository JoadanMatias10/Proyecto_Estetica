const { normalizeString } = require("./validadores");

const SYNTHETIC_SOURCE_TAG = "Semilla ML clustering recomendacion servicios v1";
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const K_CLUSTERS = 5;

const FEATURE_DEFINITIONS = [
  { key: "frecuenciaVisitas", label: "Frecuencia de visitas" },
  { key: "visitasUltimos90Dias", label: "Visitas en los ultimos 90 dias" },
  { key: "mesesConActividad", label: "Meses con actividad" },
  { key: "frecuenciaMensual", label: "Frecuencia mensual" },
  { key: "gastoTotal", label: "Gasto total" },
  { key: "gastoPromedio", label: "Gasto promedio" },
  { key: "serviciosPromedioVisita", label: "Servicios promedio por visita" },
  { key: "diversidadServicios", label: "Diversidad de servicios" },
  { key: "diasDesdeUltimaVisita", label: "Dias desde la ultima visita" },
  { key: "antiguedadClienteDias", label: "Antiguedad del cliente" },
  { key: "proporcionCortes", label: "Proporcion de cortes" },
  { key: "proporcionColor", label: "Proporcion de color" },
  { key: "proporcionEstetica", label: "Proporcion de estetica" },
  { key: "proporcionTratamientos", label: "Proporcion de tratamientos" },
  { key: "proporcionUnas", label: "Proporcion de unas" },
];

const DATASET_COLUMNS = FEATURE_DEFINITIONS.map(({ key }) => key);
const CATEGORY_PROFILES = [
  { key: "proporcionCortes", label: "Corte y peinado", shortLabel: "Cortes" },
  { key: "proporcionColor", label: "Color y corte", shortLabel: "Color" },
  { key: "proporcionEstetica", label: "Servicios de estetica", shortLabel: "Estetica" },
  { key: "proporcionTratamientos", label: "Tratamientos capilares", shortLabel: "Tratamientos" },
  { key: "proporcionUnas", label: "Servicios de unas", shortLabel: "Unas" },
];

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fullName(user) {
  return [user?.nombre, user?.apellidoPaterno, user?.apellidoMaterno]
    .map((part) => normalizeString(part))
    .filter(Boolean)
    .join(" ") || "Cliente";
}

function categoryFeatureKey(subcategory) {
  const normalized = normalizeKey(subcategory);
  if (normalized === "cortes") return "proporcionCortes";
  if (normalized === "color") return "proporcionColor";
  if (normalized === "estetica") return "proporcionEstetica";
  if (normalized === "tratamientos") return "proporcionTratamientos";
  if (normalized === "unas") return "proporcionUnas";
  return null;
}

function monthDifference(startDate, endDate) {
  return Math.max(
    1,
    (endDate.getFullYear() - startDate.getFullYear()) * 12
      + endDate.getMonth() - startDate.getMonth() + 1
  );
}

function buildServiceRecommendationDataset({ payments, users, services }) {
  const validPayments = payments
    .filter((payment) =>
      payment.tipo === "Servicio"
      && ["Pagado", "Confirmado"].includes(payment.estatus)
      && toDateOrNull(payment.createdAt)
    )
    .sort((left, right) => toDateOrNull(left.createdAt) - toDateOrNull(right.createdAt));
  if (!validPayments.length) {
    return {
      rows: [],
      source: { interactions: 0, syntheticInteractions: 0, items: 0 },
      services: [],
      clientServiceCounts: new Map(),
    };
  }

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const serviceById = new Map(services.map((service) => [String(service._id), service]));
  const referenceDate = toDateOrNull(validPayments[validPayments.length - 1].createdAt);
  const statsByClient = new Map();
  let totalItems = 0;

  validPayments.forEach((payment) => {
    const clientId = String(payment.userId || "");
    const user = userById.get(clientId);
    if (!user) return;
    const date = toDateOrNull(payment.createdAt);
    const items = (Array.isArray(payment.detalle) ? payment.detalle : [])
      .map((item) => ({ item, service: serviceById.get(String(item.itemId || "")) }))
      .filter(({ service }) => Boolean(service));
    if (!items.length) return;

    const stats = statsByClient.get(clientId) || {
      clientId,
      user,
      visits: 0,
      recentVisits: 0,
      totalSpend: 0,
      totalServices: 0,
      firstVisit: date,
      lastVisit: date,
      activeMonths: new Set(),
      serviceCounts: new Map(),
      categoryCounts: Object.fromEntries(CATEGORY_PROFILES.map(({ key }) => [key, 0])),
    };
    stats.visits += 1;
    stats.totalSpend += Number(payment.total || 0);
    stats.totalServices += items.length;
    stats.firstVisit = date < stats.firstVisit ? date : stats.firstVisit;
    stats.lastVisit = date > stats.lastVisit ? date : stats.lastVisit;
    stats.activeMonths.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    if ((referenceDate - date) / MS_PER_DAY <= 90) stats.recentVisits += 1;

    items.forEach(({ service }) => {
      const serviceId = String(service._id);
      stats.serviceCounts.set(serviceId, Number(stats.serviceCounts.get(serviceId) || 0) + 1);
      const featureKey = categoryFeatureKey(service.subcategoria);
      if (featureKey) stats.categoryCounts[featureKey] += 1;
      totalItems += 1;
    });
    statsByClient.set(clientId, stats);
  });

  const clientServiceCounts = new Map();
  const rows = Array.from(statsByClient.values()).map((stats) => {
    const totalCategorized = Object.values(stats.categoryCounts).reduce((sum, value) => sum + value, 0);
    const userCreatedAt = toDateOrNull(stats.user.createdAt) || stats.firstVisit;
    const favoriteService = [...stats.serviceCounts.entries()]
      .sort((left, right) => right[1] - left[1])[0];
    clientServiceCounts.set(stats.clientId, new Map(stats.serviceCounts));

    return {
      clienteId: stats.clientId,
      cliente: fullName(stats.user),
      correo: normalizeString(stats.user.correo),
      frecuenciaVisitas: stats.visits,
      visitasUltimos90Dias: stats.recentVisits,
      mesesConActividad: stats.activeMonths.size,
      frecuenciaMensual: Number((stats.visits / monthDifference(stats.firstVisit, referenceDate)).toFixed(4)),
      gastoTotal: Number(stats.totalSpend.toFixed(2)),
      gastoPromedio: Number((stats.totalSpend / stats.visits).toFixed(2)),
      serviciosPromedioVisita: Number((stats.totalServices / stats.visits).toFixed(4)),
      diversidadServicios: stats.serviceCounts.size,
      diasDesdeUltimaVisita: Math.max(0, Math.floor((referenceDate - stats.lastVisit) / MS_PER_DAY)),
      antiguedadClienteDias: Math.max(0, Math.floor((referenceDate - userCreatedAt) / MS_PER_DAY)),
      ...Object.fromEntries(CATEGORY_PROFILES.map(({ key }) => [
        key,
        totalCategorized ? Number((stats.categoryCounts[key] / totalCategorized).toFixed(4)) : 0,
      ])),
      servicioFavoritoId: favoriteService?.[0] || "",
      servicioFavorito: serviceById.get(favoriteService?.[0])?.nombre || "Sin servicio",
    };
  }).sort((left, right) => left.cliente.localeCompare(right.cliente, "es"));

  return {
    rows,
    source: {
      interactions: validPayments.length,
      syntheticInteractions: validPayments.filter((payment) => payment.notas === SYNTHETIC_SOURCE_TAG).length,
      items: totalItems,
      firstDate: toDateOrNull(validPayments[0].createdAt).toISOString(),
      lastDate: referenceDate.toISOString(),
    },
    services: services.map((service) => ({
      id: String(service._id),
      nombre: normalizeString(service.nombre) || "Servicio",
      segmento: normalizeString(service.segmento) || "Sin segmento",
      subcategoria: normalizeString(service.subcategoria) || "Sin categoria",
      precio: Number(service.precio || 0),
    })),
    clientServiceCounts,
  };
}

function standardizeRows(rows) {
  const means = DATASET_COLUMNS.map((key) =>
    rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length
  );
  const deviations = DATASET_COLUMNS.map((key, index) => {
    const variance = rows.reduce((sum, row) => {
      const difference = Number(row[key] || 0) - means[index];
      return sum + difference * difference;
    }, 0) / rows.length;
    const deviation = Math.sqrt(variance);
    return deviation > 0 ? deviation : 1;
  });
  return {
    means,
    deviations,
    vectors: rows.map((row) => DATASET_COLUMNS.map((key, index) =>
      (Number(row[key] || 0) - means[index]) / deviations[index]
    )),
  };
}

function euclidean(left, right) {
  return Math.sqrt(left.reduce((sum, value, index) => {
    const difference = value - right[index];
    return sum + difference * difference;
  }, 0));
}

function silhouetteScore(vectors, assignments, clusterCount) {
  const indexesByCluster = Array.from({ length: clusterCount }, () => []);
  assignments.forEach((cluster, index) => indexesByCluster[cluster].push(index));
  const scores = vectors.map((vector, index) => {
    const ownCluster = assignments[index];
    const ownIndexes = indexesByCluster[ownCluster].filter((candidate) => candidate !== index);
    if (!ownIndexes.length) return 0;
    const ownDistance = ownIndexes.reduce((sum, candidate) => sum + euclidean(vector, vectors[candidate]), 0) / ownIndexes.length;
    let nearestOtherDistance = Number.POSITIVE_INFINITY;
    indexesByCluster.forEach((indexes, cluster) => {
      if (cluster === ownCluster || !indexes.length) return;
      const average = indexes.reduce((sum, candidate) => sum + euclidean(vector, vectors[candidate]), 0) / indexes.length;
      nearestOtherDistance = Math.min(nearestOtherDistance, average);
    });
    const denominator = Math.max(ownDistance, nearestOtherDistance);
    return denominator > 0 ? (nearestOtherDistance - ownDistance) / denominator : 0;
  });
  return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(4));
}

function meanFeature(rows, key) {
  return rows.length
    ? Number((rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length).toFixed(4))
    : 0;
}

function assignUniqueClusterLabels(clusterRows, allRows) {
  const candidates = [];
  const labels = new Map();
  const overallFrequency = meanFeature(allRows, "frecuenciaVisitas");
  const overallDiversity = meanFeature(allRows, "diversidadServicios");
  const frequentCluster = clusterRows
    .map((rows, cluster) => ({
      cluster,
      frequency: meanFeature(rows, "frecuenciaVisitas"),
      diversity: meanFeature(rows, "diversidadServicios"),
    }))
    .filter((entry) => entry.frequency >= overallFrequency * 1.45 && entry.diversity >= overallDiversity * 1.15)
    .sort((left, right) => right.frequency - left.frequency)[0];
  if (frequentCluster) {
    labels.set(frequentCluster.cluster, {
      key: "frecuentesMultiservicio",
      label: "Clientes frecuentes multiservicio",
      shortLabel: "Frecuentes",
    });
  }
  clusterRows.forEach((rows, cluster) => {
    if (labels.has(cluster)) return;
    CATEGORY_PROFILES.forEach((profile) => {
      candidates.push({ cluster, profile, score: meanFeature(rows, profile.key) });
    });
  });
  candidates.sort((left, right) => right.score - left.score);
  const usedClusters = new Set();
  const usedProfiles = new Set();
  labels.forEach((_profile, cluster) => usedClusters.add(cluster));
  candidates.forEach((candidate) => {
    if (usedClusters.has(candidate.cluster) || usedProfiles.has(candidate.profile.key)) return;
    labels.set(candidate.cluster, candidate.profile);
    usedClusters.add(candidate.cluster);
    usedProfiles.add(candidate.profile.key);
  });
  clusterRows.forEach((_rows, cluster) => {
    if (labels.has(cluster)) return;
    const fallback = CATEGORY_PROFILES.find((profile) => !usedProfiles.has(profile.key)) || CATEGORY_PROFILES[0];
    labels.set(cluster, fallback);
    usedProfiles.add(fallback.key);
  });
  return labels;
}

function aggregateTopServices(rows, clientServiceCounts, serviceById) {
  const totals = new Map();
  rows.forEach((row) => {
    const counts = clientServiceCounts.get(row.clienteId) || new Map();
    counts.forEach((count, serviceId) => {
      totals.set(serviceId, Number(totals.get(serviceId) || 0) + Number(count || 0));
    });
  });
  const totalUses = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(totals.entries())
    .map(([serviceId, count]) => ({
      serviceId,
      nombre: serviceById.get(serviceId)?.nombre || "Servicio",
      subcategoria: serviceById.get(serviceId)?.subcategoria || "Sin categoria",
      precio: Number(serviceById.get(serviceId)?.precio || 0),
      consumos: count,
      participacion: totalUses ? Number((count / totalUses).toFixed(4)) : 0,
    }))
    .sort((left, right) => right.consumos - left.consumos || left.nombre.localeCompare(right.nombre, "es"));
}

async function runServiceRecommendationClustering(dataset) {
  const { rows, clientServiceCounts } = dataset;
  if (rows.length < K_CLUSTERS * 5) {
    return {
      available: false,
      summary: { available: false, message: "Se requieren al menos 25 clientes para ejecutar K-Means." },
    };
  }
  const { kmeans } = await import("ml-kmeans");
  const standardized = standardizeRows(rows);
  const result = kmeans(standardized.vectors, K_CLUSTERS, {
    initialization: "kmeans++",
    maxIterations: 200,
    tolerance: 1e-6,
    seed: 42,
  });
  const clusterRows = Array.from({ length: K_CLUSTERS }, () => []);
  result.clusters.forEach((cluster, index) => clusterRows[cluster].push(rows[index]));
  const labels = assignUniqueClusterLabels(clusterRows, rows);
  const serviceById = new Map(dataset.services.map((service) => [service.id, service]));
  const clusters = clusterRows.map((members, cluster) => {
    const profile = labels.get(cluster);
    const topServices = aggregateTopServices(members, clientServiceCounts, serviceById).slice(0, 6);
    return {
      id: cluster,
      label: profile.label,
      shortLabel: profile.shortLabel,
      size: members.length,
      percentage: Number(((members.length / rows.length) * 100).toFixed(1)),
      centroid: Object.fromEntries(DATASET_COLUMNS.map((key) => [key, meanFeature(members, key)])),
      topServices,
    };
  });
  const clusterById = new Map(clusters.map((cluster) => [cluster.id, cluster]));
  const annotatedRows = rows.map((row, index) => {
    const cluster = clusterById.get(result.clusters[index]);
    const consumed = clientServiceCounts.get(row.clienteId) || new Map();
    const recommendation = cluster.topServices.find((service) => !consumed.has(service.serviceId)) || cluster.topServices[0];
    return {
      ...row,
      clusterId: cluster.id,
      cluster: cluster.label,
      recomendacionPrincipal: recommendation?.nombre || "Sin recomendacion",
    };
  });
  const information = result.computeInformation(standardized.vectors);
  const inertia = information.reduce((sum, cluster) => sum + Number(cluster.error || 0) * Number(cluster.size || 0), 0);

  return {
    available: true,
    result,
    standardized,
    clusters,
    rows: annotatedRows,
    summary: {
      available: true,
      name: "K-Means",
      library: "ml-kmeans 7.0.1",
      k: K_CLUSTERS,
      initialization: "kmeans++",
      scaling: "estandarizacion z-score",
      converged: Boolean(result.converged),
      iterations: Number(result.iterations || 0),
      silhouette: silhouetteScore(standardized.vectors, result.clusters, K_CLUSTERS),
      inertia: Number(inertia.toFixed(4)),
      featureCount: DATASET_COLUMNS.length,
      rows: rows.length,
    },
  };
}

function recommendServicesForClient(context, clientId, clientServiceCounts) {
  if (!context?.available) throw new Error("El modelo K-Means no esta disponible.");
  const row = context.rows.find((entry) => entry.clienteId === clientId);
  if (!row) throw new Error("El cliente no forma parte del dataset de clustering.");
  const cluster = context.clusters.find((entry) => entry.id === row.clusterId);
  const consumed = clientServiceCounts.get(clientId) || new Map();
  const unseen = cluster.topServices.filter((service) => !consumed.has(service.serviceId));
  const recommendations = (unseen.length ? unseen : cluster.topServices)
    .slice(0, 3)
    .map((service) => ({ ...service, alreadyUsed: consumed.has(service.serviceId) }));
  return {
    clienteId: row.clienteId,
    cliente: row.cliente,
    clusterId: cluster.id,
    cluster: cluster.label,
    clusterSize: cluster.size,
    metrics: Object.fromEntries(DATASET_COLUMNS.map((key) => [key, row[key]])),
    servicioFavorito: row.servicioFavorito,
    recommendations,
  };
}

module.exports = {
  DATASET_COLUMNS,
  FEATURE_DEFINITIONS,
  K_CLUSTERS,
  SYNTHETIC_SOURCE_TAG,
  buildServiceRecommendationDataset,
  recommendServicesForClient,
  runServiceRecommendationClustering,
};
