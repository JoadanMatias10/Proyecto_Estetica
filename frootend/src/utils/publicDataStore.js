const DATABASE_NAME = "estetica-panamericana-public";
const DATABASE_VERSION = 1;
const STORE_NAME = "public-datasets";

export const PUBLIC_DATA_KEYS = Object.freeze({
  companyInfo: "company-info",
  products: "products",
  services: "services",
  promotions: "promotions",
  homeHighlights: "home-highlights",
});

function normalizeString(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeId(value) {
  return normalizeString(value);
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeBoolean(value) {
  return Boolean(value);
}

function compactRecord(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  );
}

export function sanitizePublicProduct(product) {
  const id = normalizeId(product?.id || product?._id);
  const nombre = normalizeString(product?.nombre);
  if (!id || !nombre) return null;

  return compactRecord({
    id,
    nombre,
    descripcion: normalizeString(product?.descripcion),
    categoria: normalizeString(product?.categoria),
    marca: normalizeString(product?.marca),
    precio: normalizeNumber(product?.precio),
    imagen: normalizeString(product?.imagen),
    rating: normalizeNumber(product?.rating, 4.8),
    cantidadMedida: product?.cantidadMedida === null || product?.cantidadMedida === undefined
      ? undefined
      : normalizeNumber(product.cantidadMedida),
    unidadMedida: normalizeString(product?.unidadMedida),
    destacadoInicio: normalizeBoolean(product?.destacadoInicio),
    updatedAt: normalizeString(product?.updatedAt),
  });
}

export function sanitizePublicService(service) {
  const id = normalizeId(service?.id || service?._id);
  const nombre = normalizeString(service?.nombre);
  if (!id || !nombre) return null;

  const galeriaImagenes = (Array.isArray(service?.galeriaImagenes) ? service.galeriaImagenes : [])
    .map((image) => ({
      url: normalizeString(image?.url),
      nombre: normalizeString(image?.nombre),
    }))
    .filter((image) => image.url);

  return compactRecord({
    id,
    nombre,
    descripcion: normalizeString(service?.descripcion),
    segmento: normalizeString(service?.segmento),
    subcategoria: normalizeString(service?.subcategoria),
    precio: normalizeNumber(service?.precio),
    tiempo: normalizeString(service?.tiempo || service?.duracion),
    imagen: normalizeString(service?.imagen),
    galeriaImagenes,
    destacadoInicio: normalizeBoolean(service?.destacadoInicio),
    updatedAt: normalizeString(service?.updatedAt),
  });
}

export function sanitizePublicPromotion(promotion) {
  const id = normalizeId(promotion?.id || promotion?._id);
  const titulo = normalizeString(promotion?.titulo);
  if (!id || !titulo) return null;

  return {
    id,
    titulo,
    descripcion: normalizeString(promotion?.descripcion),
    descuento: normalizeString(promotion?.descuento),
    estado: normalizeString(promotion?.estado),
    destacadoInicio: normalizeBoolean(promotion?.destacadoInicio),
    createdAt: normalizeString(promotion?.createdAt),
    updatedAt: normalizeString(promotion?.updatedAt),
  };
}

function sanitizeProductCategory(category) {
  const nombre = normalizeString(category?.nombre);
  if (!nombre) return null;
  return {
    id: normalizeId(category?.id || category?._id),
    nombre,
    subcategorias: (Array.isArray(category?.subcategorias) ? category.subcategorias : [])
      .map(normalizeString)
      .filter(Boolean),
  };
}

function sanitizeServiceCategory(category) {
  const nombre = normalizeString(category?.nombre);
  if (!nombre) return null;
  return {
    id: normalizeId(category?.id || category?._id),
    nombre,
    segmento: normalizeString(category?.segmento),
  };
}

export function sanitizePublicCompanyInfo(companyInfo) {
  if (!companyInfo || typeof companyInfo !== "object") return null;
  const allowedFields = [
    "nombre",
    "direccion",
    "telefono",
    "email",
    "mision",
    "vision",
    "valores",
    "facebook",
    "instagram",
    "quienesSomosTexto",
    "quienesSomosEsencia",
    "horarioLunesSabado",
    "horarioDomingo",
    "mapLat",
    "mapLng",
    "mapZoom",
    "mapGoogleUrl",
    "updatedAt",
  ];

  return allowedFields.reduce((result, field) => {
    result[field] = normalizeString(companyInfo[field]);
    return result;
  }, {});
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no está disponible en este navegador."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error || new Error("No fue posible abrir IndexedDB."));
    request.onblocked = () => reject(new Error("La actualización del almacenamiento local está bloqueada."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function runTransaction(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error("Falló el almacenamiento local."));
      transaction.onabort = () => reject(transaction.error || new Error("Se canceló el almacenamiento local."));
      result = operation(store);
    });
  } finally {
    database.close();
  }
}

export async function writePublicDataset(key, value) {
  const updatedAt = new Date().toISOString();
  await runTransaction("readwrite", (store) => store.put({ key, value, updatedAt }));
  return updatedAt;
}

export async function readPublicDataset(key) {
  const request = await runTransaction("readonly", (store) => store.get(key));
  return request?.result || null;
}

export async function saveProductsBundle({ products, categories }) {
  const value = {
    products: (Array.isArray(products) ? products : []).map(sanitizePublicProduct).filter(Boolean),
    categories: (Array.isArray(categories) ? categories : []).map(sanitizeProductCategory).filter(Boolean),
  };
  return writePublicDataset(PUBLIC_DATA_KEYS.products, value);
}

export async function readProductsBundle() {
  return readPublicDataset(PUBLIC_DATA_KEYS.products);
}

export async function upsertPublicProduct(product) {
  const sanitized = sanitizePublicProduct(product);
  if (!sanitized) return "";
  const current = await readProductsBundle().catch(() => null);
  const products = Array.isArray(current?.value?.products) ? current.value.products : [];
  const nextProducts = [sanitized, ...products.filter((item) => String(item.id) !== sanitized.id)];
  return saveProductsBundle({ products: nextProducts, categories: current?.value?.categories || [] });
}

export async function findPublicProduct(id) {
  const current = await readProductsBundle();
  return current?.value?.products?.find((product) => String(product.id) === String(id)) || null;
}

export async function saveServicesBundle({ services, serviceCategories }) {
  const value = {
    services: (Array.isArray(services) ? services : []).map(sanitizePublicService).filter(Boolean),
    serviceCategories: (Array.isArray(serviceCategories) ? serviceCategories : [])
      .map(sanitizeServiceCategory)
      .filter(Boolean),
  };
  return writePublicDataset(PUBLIC_DATA_KEYS.services, value);
}

export async function readServicesBundle() {
  return readPublicDataset(PUBLIC_DATA_KEYS.services);
}

export async function upsertPublicService(service) {
  const sanitized = sanitizePublicService(service);
  if (!sanitized) return "";
  const current = await readServicesBundle().catch(() => null);
  const services = Array.isArray(current?.value?.services) ? current.value.services : [];
  const nextServices = [sanitized, ...services.filter((item) => String(item.id) !== sanitized.id)];
  return saveServicesBundle({ services: nextServices, serviceCategories: current?.value?.serviceCategories || [] });
}

export async function findPublicService(id) {
  const current = await readServicesBundle();
  return current?.value?.services?.find((service) => String(service.id) === String(id)) || null;
}

export async function savePromotions(promotions) {
  const value = (Array.isArray(promotions) ? promotions : [])
    .map(sanitizePublicPromotion)
    .filter(Boolean);
  return writePublicDataset(PUBLIC_DATA_KEYS.promotions, value);
}

export async function readPromotions() {
  return readPublicDataset(PUBLIC_DATA_KEYS.promotions);
}

export async function saveCompanyInfo(companyInfo) {
  const value = sanitizePublicCompanyInfo(companyInfo);
  if (!value) return "";
  return writePublicDataset(PUBLIC_DATA_KEYS.companyInfo, value);
}

export async function readCompanyInfo() {
  return readPublicDataset(PUBLIC_DATA_KEYS.companyInfo);
}

export async function saveHomeHighlights({ products, services, promotions }) {
  const value = {
    products: (Array.isArray(products) ? products : []).map(sanitizePublicProduct).filter(Boolean),
    services: (Array.isArray(services) ? services : []).map(sanitizePublicService).filter(Boolean),
    promotions: (Array.isArray(promotions) ? promotions : []).map(sanitizePublicPromotion).filter(Boolean),
  };
  return writePublicDataset(PUBLIC_DATA_KEYS.homeHighlights, value);
}

export async function readHomeHighlights() {
  return readPublicDataset(PUBLIC_DATA_KEYS.homeHighlights);
}
