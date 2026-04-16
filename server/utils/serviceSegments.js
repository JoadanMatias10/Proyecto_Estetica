const SERVICE_SEGMENTS = ["Dama", "Caballero", "Ni\u00f1o"];

const SERVICE_SEGMENT_ALIASES = new Map([
  ["dama", "Dama"],
  ["mujer", "Dama"],
  ["caballero", "Caballero"],
  ["hombre", "Caballero"],
  ["nino", "Ni\u00f1o"],
]);

const SERVICE_SEGMENT_VALUES_BY_CANONICAL = {
  Dama: ["Dama", "Mujer"],
  Caballero: ["Caballero", "Hombre"],
  "Ni\u00f1o": ["Ni\u00f1o", "Nino"],
};

function normalizeSegmentKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeServiceSegment(value, fallback = SERVICE_SEGMENTS[0]) {
  const canonical = SERVICE_SEGMENT_ALIASES.get(normalizeSegmentKey(value));
  return canonical || fallback;
}

function getServiceSegmentValues(value) {
  const canonical = normalizeServiceSegment(value);
  const aliases = SERVICE_SEGMENT_VALUES_BY_CANONICAL[canonical] || [canonical];
  return Array.from(new Set(aliases));
}

function buildServiceSegmentFilter(value, field = "segmento") {
  return {
    [field]: { $in: getServiceSegmentValues(value) },
  };
}

function normalizeServiceSegmentInRecord(record) {
  if (!record || !record.segmento) return record;
  return {
    ...record,
    segmento: normalizeServiceSegment(record.segmento),
  };
}

module.exports = {
  SERVICE_SEGMENTS,
  normalizeServiceSegment,
  getServiceSegmentValues,
  buildServiceSegmentFilter,
  normalizeServiceSegmentInRecord,
};
