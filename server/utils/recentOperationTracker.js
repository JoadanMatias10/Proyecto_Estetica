const DEFAULT_WINDOW_MS = 30000;
const MAX_EVENT_HISTORY = 2000;
const ALLOWED_TYPES = new Set(["insert", "update", "delete"]);

const recentOperations = [];
const cumulativeByCollection = new Map();

function createEmptySummary(intervalMs = 0, fromMs = Date.now(), toMs = Date.now()) {
  return {
    insert: 0,
    update: 0,
    delete: 0,
    total: 0,
    intervalMs,
    desde: new Date(fromMs).toISOString(),
    hasta: new Date(toMs).toISOString(),
  };
}

function toValidDate(value = new Date()) {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getStartOfDay(value = new Date()) {
  const parsed = toValidDate(value);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function getDayKey(value = new Date()) {
  const startOfDay = getStartOfDay(value);
  const year = startOfDay.getFullYear();
  const month = String(startOfDay.getMonth() + 1).padStart(2, "0");
  const day = String(startOfDay.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDailySummary(value = new Date()) {
  const parsed = toValidDate(value);
  const startOfDay = getStartOfDay(parsed);
  return {
    ...createEmptySummary(
      Math.max(parsed.getTime() - startOfDay.getTime(), 0),
      startOfDay.getTime(),
      parsed.getTime()
    ),
    dayKey: getDayKey(parsed),
  };
}

function getCollectionSummary(collection, value = new Date()) {
  const normalizedCollection = String(collection || "").trim();
  if (!normalizedCollection) return null;

  const dayKey = getDayKey(value);
  const currentSummary = cumulativeByCollection.get(normalizedCollection);

  if (!currentSummary || currentSummary.dayKey !== dayKey) {
    cumulativeByCollection.set(normalizedCollection, createDailySummary(value));
  }

  return cumulativeByCollection.get(normalizedCollection);
}

function pruneRecentOperations(nowMs = Date.now(), maxAgeMs = DEFAULT_WINDOW_MS * 10) {
  const minTimestamp = nowMs - maxAgeMs;
  while (recentOperations.length > 0 && recentOperations[0].timestamp < minTimestamp) {
    recentOperations.shift();
  }

  if (recentOperations.length > MAX_EVENT_HISTORY) {
    recentOperations.splice(0, recentOperations.length - MAX_EVENT_HISTORY);
  }
}

function recordRecentOperation({ collection = "", type = "", at = new Date() } = {}) {
  const normalizedCollection = String(collection || "").trim();
  const normalizedType = String(type || "").trim().toLowerCase();

  if (!normalizedCollection || !ALLOWED_TYPES.has(normalizedType)) return;

  const eventDate = toValidDate(at);
  const eventTimestamp = eventDate.getTime();
  const startOfDay = getStartOfDay(eventDate);

  recentOperations.push({
    collection: normalizedCollection,
    type: normalizedType,
    timestamp: eventTimestamp,
  });

  const cumulative = getCollectionSummary(normalizedCollection, eventDate);
  if (cumulative) {
    cumulative[normalizedType] += 1;
    cumulative.total += 1;
    cumulative.desde = startOfDay.toISOString();
    cumulative.hasta = eventDate.toISOString();
    cumulative.intervalMs = Math.max(eventTimestamp - startOfDay.getTime(), 0);
  }

  pruneRecentOperations();
}

function summarizeRecentOperations(windowMs = DEFAULT_WINDOW_MS, collections = []) {
  const nowMs = Date.now();
  const safeWindowMs = Math.max(Number(windowMs) || DEFAULT_WINDOW_MS, 1000);
  const sinceMs = nowMs - safeWindowMs;
  const collectionFilter = Array.isArray(collections) && collections.length
    ? new Set(collections.map((item) => String(item || "").trim()).filter(Boolean))
    : null;

  pruneRecentOperations(nowMs, safeWindowMs * 10);

  const summary = createEmptySummary(safeWindowMs, sinceMs, nowMs);

  recentOperations.forEach((event) => {
    if (event.timestamp < sinceMs) return;
    if (collectionFilter && !collectionFilter.has(event.collection)) return;

    summary[event.type] += 1;
    summary.total += 1;
  });

  return summary;
}

function summarizeAccumulatedOperations(collections = []) {
  const nowMs = Date.now();
  const now = new Date(nowMs);
  const startOfDay = getStartOfDay(now);
  const currentDayKey = getDayKey(now);
  const collectionFilter = Array.isArray(collections) && collections.length
    ? new Set(collections.map((item) => String(item || "").trim()).filter(Boolean))
    : null;

  const summary = createEmptySummary(
    Math.max(nowMs - startOfDay.getTime(), 0),
    startOfDay.getTime(),
    nowMs
  );

  cumulativeByCollection.forEach((collectionSummary, collectionName) => {
    if (collectionFilter && !collectionFilter.has(collectionName)) return;
    if (collectionSummary?.dayKey !== currentDayKey) return;

    summary.insert += Number(collectionSummary.insert || 0);
    summary.update += Number(collectionSummary.update || 0);
    summary.delete += Number(collectionSummary.delete || 0);
  });

  summary.total = summary.insert + summary.update + summary.delete;
  return summary;
}

module.exports = {
  recordRecentOperation,
  summarizeRecentOperations,
  summarizeAccumulatedOperations,
};
