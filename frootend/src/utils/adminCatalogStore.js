import { PRODUCT_CATEGORIES } from "./productCategories";
import { SERVICES_CATALOG, SERVICE_SEGMENTS } from "./servicesCatalog";

const PRODUCT_CATEGORIES_KEY = "admin.product.categories.v1";
const PRODUCT_BRANDS_KEY = "admin.product.brands.v1";
const SERVICE_CATEGORIES_KEY = "admin.service.categories.v1";

const DEFAULT_PRODUCT_BRANDS = [
  { id: 1, nombre: "Avyna", pais: "Mexico", estado: "Activa", descripcion: "Marca principal del catalogo." },
  { id: 2, nombre: "Wella", pais: "Alemania", estado: "Activa", descripcion: "Linea profesional para coloracion." },
  { id: 3, nombre: "Loreal Professionnel", pais: "Francia", estado: "Inactiva", descripcion: "Marca disponible por temporadas." },
];

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

function normalizeSubcategories(value) {
  if (!Array.isArray(value)) return [];
  const unique = new Set(
    value
      .map((item) => item?.toString().trim())
      .filter(Boolean)
  );
  return Array.from(unique);
}

function buildDefaultProductCategoryRecords() {
  return Object.entries(PRODUCT_CATEGORIES).map(([nombre, subcategorias], index) => ({
    id: index + 1,
    nombre,
    descripcion: `Categoria para ${nombre.toLowerCase()}.`,
    estado: "Activa",
    subcategorias: normalizeSubcategories(subcategorias),
  }));
}

function buildDefaultServiceCategoryRecords() {
  const uniqueBySegment = new Map();

  SERVICES_CATALOG.forEach((service) => {
    const key = `${service.segmento}-${service.subcategoria}`;
    if (!uniqueBySegment.has(key)) {
      uniqueBySegment.set(key, {
        id: uniqueBySegment.size + 1,
        nombre: service.subcategoria,
        segmento: service.segmento,
        estado: "Activa",
        descripcion: `Categoria de servicio para ${service.segmento.toLowerCase()}.`,
      });
    }
  });

  return Array.from(uniqueBySegment.values());
}

export function getProductCategoryRecords() {
  const fallback = buildDefaultProductCategoryRecords();
  const records = safeRead(PRODUCT_CATEGORIES_KEY, fallback);
  if (!Array.isArray(records)) return fallback;

  return records
    .filter((record) => record && record.nombre)
    .map((record, index) => ({
      id: record.id || Date.now() + index,
      nombre: record.nombre.toString().trim(),
      descripcion: (record.descripcion || "").toString().trim(),
      estado: record.estado === "Inactiva" ? "Inactiva" : "Activa",
      subcategorias: normalizeSubcategories(record.subcategorias),
    }))
    .filter((record) => record.nombre);
}

export function saveProductCategoryRecords(records) {
  safeWrite(PRODUCT_CATEGORIES_KEY, records);
}

export function getProductCategoriesMap() {
  const map = {};
  getProductCategoryRecords().forEach((record) => {
    map[record.nombre] = normalizeSubcategories(record.subcategorias);
  });
  return map;
}

export function getProductBrands() {
  const records = safeRead(PRODUCT_BRANDS_KEY, DEFAULT_PRODUCT_BRANDS);
  if (!Array.isArray(records)) return DEFAULT_PRODUCT_BRANDS;

  return records
    .filter((record) => record && record.nombre)
    .map((record, index) => ({
      id: record.id || Date.now() + index,
      nombre: record.nombre.toString().trim(),
      pais: (record.pais || "").toString().trim(),
      estado: record.estado === "Inactiva" ? "Inactiva" : "Activa",
      descripcion: (record.descripcion || "").toString().trim(),
    }))
    .filter((record) => record.nombre);
}

export function saveProductBrands(records) {
  safeWrite(PRODUCT_BRANDS_KEY, records);
}

export function getServiceCategoryRecords() {
  const fallback = buildDefaultServiceCategoryRecords();
  const records = safeRead(SERVICE_CATEGORIES_KEY, fallback);
  if (!Array.isArray(records)) return fallback;

  return records
    .filter((record) => record && record.nombre)
    .map((record, index) => ({
      id: record.id || Date.now() + index,
      nombre: record.nombre.toString().trim(),
      segmento: SERVICE_SEGMENTS.includes(record.segmento) ? record.segmento : SERVICE_SEGMENTS[0],
      estado: record.estado === "Inactiva" ? "Inactiva" : "Activa",
      descripcion: (record.descripcion || "").toString().trim(),
    }))
    .filter((record) => record.nombre);
}

export function saveServiceCategoryRecords(records) {
  safeWrite(SERVICE_CATEGORIES_KEY, records);
}

export function getServiceSubcategoriesBySegment(segmento) {
  if (!segmento) return [];

  const unique = new Set(
    getServiceCategoryRecords()
      .filter((record) => record.segmento === segmento)
      .map((record) => record.nombre)
  );

  return Array.from(unique);
}
