const DEFAULT_SERVICE_DURATION_MINUTES = 30;

function parseServiceDurationMinutes(value, fallback = DEFAULT_SERVICE_DURATION_MINUTES) {
  const normalized = String(value || "").toLowerCase().trim();
  if (!normalized) return fallback;

  const hourMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hora|horas)\b/);
  const minuteMatch = normalized.match(/(\d+)\s*(m|min|mins|minuto|minutos)\b/);
  const timeMatch = normalized.match(/^(\d{1,2}):([0-5]\d)$/);

  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const total = hours * 60 + minutes;
    return total > 0 ? total : fallback;
  }

  let total = 0;
  if (hourMatch) {
    total += Math.round(Number(hourMatch[1].replace(",", ".")) * 60);
  }
  if (minuteMatch) {
    total += Number(minuteMatch[1]);
  }

  if (!total) {
    const plainNumber = Number(normalized.replace(/[^\d.]/g, ""));
    if (Number.isFinite(plainNumber) && plainNumber > 0) total = plainNumber;
  }

  if (!Number.isFinite(total) || total <= 0) return fallback;
  return Math.max(15, Math.min(Math.round(total), 480));
}

module.exports = {
  DEFAULT_SERVICE_DURATION_MINUTES,
  parseServiceDurationMinutes,
};
