const COMPANY_INFO_KEY = "admin.company.info.v1";

const DEFAULT_COMPANY_INFO = {
  nombre: "Estetica Panamericana",
  direccion: "Av. Principal #123, Ciudad",
  telefono: "555-1234",
  email: "contacto@estetica.com",
  mision: "Brindar servicios de belleza de la mas alta calidad.",
  vision: "Ser la estetica lider en la region.",
  valores: "Compromiso, Calidad, Higiene",
  facebook: "facebook.com/estetica",
  instagram: "instagram.com/estetica",
  quienesSomosTexto:
    "En Estetica Panamericana combinamos pasion, profesionalismo y productos de calidad para realzar tu belleza.",
  quienesSomosEsencia:
    "Atencion personalizada\nEstilistas certificados\nExperiencia premium\nProductos profesionales AVYNA",
  horarioLunesViernes: "Lunes a Sabado: 9:00 am - 7:00 pm",
  horarioSabado: "Domingo: 10:00 am - 3:00 pm",
  mapLat: "19.4326",
  mapLng: "-99.1332",
  mapZoom: "15",
  mapGoogleUrl: "https://www.google.com/maps?q=19.4326,-99.1332",
  politicasDocumento: "",
  politicasDocumentoNombre: "",
  politicasDocumentoTipo: "",
};

function safeRead(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
}

function safeWrite(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_error) {
    // Ignore localStorage write errors.
  }
}

function normalizeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function normalizeNumberString(value, fallback = "") {
  const normalized = normalizeString(value, fallback);
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}

export function getCompanyInfo() {
  const raw = safeRead(COMPANY_INFO_KEY, DEFAULT_COMPANY_INFO);

  return {
    nombre: normalizeString(raw.nombre, DEFAULT_COMPANY_INFO.nombre),
    direccion: normalizeString(raw.direccion, DEFAULT_COMPANY_INFO.direccion),
    telefono: normalizeString(raw.telefono, DEFAULT_COMPANY_INFO.telefono),
    email: normalizeString(raw.email, DEFAULT_COMPANY_INFO.email),
    mision: normalizeString(raw.mision, DEFAULT_COMPANY_INFO.mision),
    vision: normalizeString(raw.vision, DEFAULT_COMPANY_INFO.vision),
    valores: normalizeString(raw.valores, DEFAULT_COMPANY_INFO.valores),
    facebook: normalizeString(raw.facebook, DEFAULT_COMPANY_INFO.facebook),
    instagram: normalizeString(raw.instagram, DEFAULT_COMPANY_INFO.instagram),
    quienesSomosTexto: normalizeString(raw.quienesSomosTexto, DEFAULT_COMPANY_INFO.quienesSomosTexto),
    quienesSomosEsencia: normalizeString(raw.quienesSomosEsencia, DEFAULT_COMPANY_INFO.quienesSomosEsencia),
    horarioLunesViernes: normalizeString(raw.horarioLunesViernes, DEFAULT_COMPANY_INFO.horarioLunesViernes),
    horarioSabado: normalizeString(raw.horarioSabado, DEFAULT_COMPANY_INFO.horarioSabado),
    mapLat: normalizeNumberString(raw.mapLat, DEFAULT_COMPANY_INFO.mapLat),
    mapLng: normalizeNumberString(raw.mapLng, DEFAULT_COMPANY_INFO.mapLng),
    mapZoom: normalizeNumberString(raw.mapZoom, DEFAULT_COMPANY_INFO.mapZoom),
    mapGoogleUrl: normalizeString(raw.mapGoogleUrl, DEFAULT_COMPANY_INFO.mapGoogleUrl),
    politicasDocumento: normalizeString(raw.politicasDocumento, DEFAULT_COMPANY_INFO.politicasDocumento),
    politicasDocumentoNombre: normalizeString(raw.politicasDocumentoNombre, DEFAULT_COMPANY_INFO.politicasDocumentoNombre),
    politicasDocumentoTipo: normalizeString(raw.politicasDocumentoTipo, DEFAULT_COMPANY_INFO.politicasDocumentoTipo),
  };
}

export function saveCompanyInfo(info) {
  const normalized = {
    ...getCompanyInfo(),
    ...info,
  };
  safeWrite(COMPANY_INFO_KEY, normalized);
  return normalized;
}
