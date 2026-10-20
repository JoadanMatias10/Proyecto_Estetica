import { endpoints, requestJson } from "../api";
import {
  findPublicProduct,
  findPublicService,
  readCompanyInfo,
  readHomeHighlights,
  readProductsBundle,
  readPromotions,
  readServicesBundle,
  saveCompanyInfo,
  saveHomeHighlights,
  saveProductsBundle,
  savePromotions,
  saveServicesBundle,
  upsertPublicProduct,
  upsertPublicService,
} from "./publicDataStore";

function isBrowserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function createOfflineCacheMissError(datasetLabel) {
  const error = new Error(
    `No hay conexión a internet y todavía no existe una copia guardada de ${datasetLabel}.`
  );
  error.name = "OfflineCacheMissError";
  error.code = "OFFLINE_CACHE_MISS";
  return error;
}

function isOfflineResponse(data) {
  return Boolean(data?.__pwa?.offlineFallback) || isBrowserOffline();
}

async function safeWrite(operation) {
  try {
    return await operation();
  } catch (_error) {
    return "";
  }
}

async function safeRead(operation) {
  try {
    return await operation();
  } catch (_error) {
    return null;
  }
}

export function buildProductCategoriesMap(categoryRecords) {
  return (Array.isArray(categoryRecords) ? categoryRecords : []).reduce((acc, category) => {
    if (!category?.nombre) return acc;
    acc[category.nombre] = Array.isArray(category.subcategorias) ? category.subcategorias : [];
    return acc;
  }, {});
}

export function getServiceSegments(serviceCategories, services) {
  const fromCategories = Array.isArray(serviceCategories)
    ? serviceCategories.map((category) => category.segmento).filter(Boolean)
    : [];
  const fromServices = Array.isArray(services)
    ? services.map((service) => service.segmento).filter(Boolean)
    : [];
  return Array.from(new Set([...fromCategories, ...fromServices]));
}

export function getServiceSubcategoriesBySegment(serviceCategories, services, segment) {
  if (!segment) return [];
  const fromCategories = Array.isArray(serviceCategories)
    ? serviceCategories
      .filter((category) => category.segmento === segment)
      .map((category) => category.nombre)
    : [];
  const fromServices = Array.isArray(services)
    ? services
      .filter((service) => service.segmento === segment)
      .map((service) => service.subcategoria)
    : [];
  return Array.from(new Set([...fromCategories, ...fromServices].filter(Boolean)));
}

export async function fetchPublicCompanyInfo() {
  if (isBrowserOffline()) {
    const cached = await safeRead(readCompanyInfo);
    if (cached?.value) {
      return { ...cached.value, __offline: true, __cachedAt: cached.updatedAt };
    }
    throw createOfflineCacheMissError("la información del negocio");
  }

  try {
    const data = await requestJson(endpoints.publicCompanyInfo);
    const companyInfo = data.companyInfo || null;
    const storedAt = companyInfo ? await safeWrite(() => saveCompanyInfo(companyInfo)) : "";
    if (!companyInfo) return null;
    return {
      ...companyInfo,
      __offline: isOfflineResponse(data),
      __cachedAt: data.__pwa?.cachedAt || storedAt,
    };
  } catch (networkError) {
    const cached = await safeRead(readCompanyInfo);
    if (cached?.value) {
      return { ...cached.value, __offline: true, __cachedAt: cached.updatedAt };
    }
    throw networkError;
  }
}

export async function fetchPublicProductsBundle() {
  if (isBrowserOffline()) {
    const cached = await safeRead(readProductsBundle);
    if (cached?.value) {
      const products = Array.isArray(cached.value.products) ? cached.value.products : [];
      const categories = Array.isArray(cached.value.categories) ? cached.value.categories : [];
      return {
        products,
        categories,
        categoriesMap: buildProductCategoriesMap(categories),
        isOfflineFallback: true,
        cachedAt: cached.updatedAt,
      };
    }
    throw createOfflineCacheMissError("los productos y sus categorías");
  }

  try {
    const [productsData, categoriesData] = await Promise.all([
      requestJson(endpoints.publicProducts),
      requestJson(endpoints.publicProductCategories),
    ]);
    const products = Array.isArray(productsData.products) ? productsData.products : [];
    const categories = Array.isArray(categoriesData.categories) ? categoriesData.categories : [];
    const storedAt = await safeWrite(() => saveProductsBundle({ products, categories }));
    return {
      products,
      categories,
      categoriesMap: buildProductCategoriesMap(categories),
      isOfflineFallback: isOfflineResponse(productsData) || isOfflineResponse(categoriesData),
      cachedAt: productsData.__pwa?.cachedAt || categoriesData.__pwa?.cachedAt || storedAt,
    };
  } catch (networkError) {
    const cached = await safeRead(readProductsBundle);
    if (cached?.value) {
      const products = Array.isArray(cached.value.products) ? cached.value.products : [];
      const categories = Array.isArray(cached.value.categories) ? cached.value.categories : [];
      return {
        products,
        categories,
        categoriesMap: buildProductCategoriesMap(categories),
        isOfflineFallback: true,
        cachedAt: cached.updatedAt,
      };
    }
    throw networkError;
  }
}

export async function fetchPublicServicesBundle() {
  if (isBrowserOffline()) {
    const cached = await safeRead(readServicesBundle);
    if (cached?.value) {
      const services = Array.isArray(cached.value.services) ? cached.value.services : [];
      const serviceCategories = Array.isArray(cached.value.serviceCategories)
        ? cached.value.serviceCategories
        : [];
      return {
        services,
        serviceCategories,
        serviceSegments: getServiceSegments(serviceCategories, services),
        isOfflineFallback: true,
        cachedAt: cached.updatedAt,
      };
    }
    throw createOfflineCacheMissError("los servicios y sus categorías");
  }

  try {
    const [servicesData, categoriesData] = await Promise.all([
      requestJson(endpoints.publicServices),
      requestJson(endpoints.publicServiceCategories),
    ]);
    const services = Array.isArray(servicesData.services) ? servicesData.services : [];
    const serviceCategories = Array.isArray(categoriesData.categories) ? categoriesData.categories : [];
    const storedAt = await safeWrite(() => saveServicesBundle({ services, serviceCategories }));
    return {
      services,
      serviceCategories,
      serviceSegments: getServiceSegments(serviceCategories, services),
      isOfflineFallback: isOfflineResponse(servicesData) || isOfflineResponse(categoriesData),
      cachedAt: servicesData.__pwa?.cachedAt || categoriesData.__pwa?.cachedAt || storedAt,
    };
  } catch (networkError) {
    const cached = await safeRead(readServicesBundle);
    if (cached?.value) {
      const services = Array.isArray(cached.value.services) ? cached.value.services : [];
      const serviceCategories = Array.isArray(cached.value.serviceCategories)
        ? cached.value.serviceCategories
        : [];
      return {
        services,
        serviceCategories,
        serviceSegments: getServiceSegments(serviceCategories, services),
        isOfflineFallback: true,
        cachedAt: cached.updatedAt,
      };
    }
    throw networkError;
  }
}

export async function fetchPublicPromotions({ withMeta = false } = {}) {
  if (isBrowserOffline()) {
    const cached = await safeRead(readPromotions);
    if (cached?.value) {
      const result = {
        promotions: Array.isArray(cached.value) ? cached.value : [],
        isOfflineFallback: true,
        cachedAt: cached.updatedAt,
      };
      return withMeta ? result : result.promotions;
    }
    throw createOfflineCacheMissError("las promociones");
  }

  try {
    const data = await requestJson(endpoints.publicPromotions);
    const promotions = Array.isArray(data.promotions) ? data.promotions : [];
    const storedAt = await safeWrite(() => savePromotions(promotions));
    const result = {
      promotions,
      isOfflineFallback: isOfflineResponse(data),
      cachedAt: data.__pwa?.cachedAt || storedAt,
    };
    return withMeta ? result : promotions;
  } catch (error) {
    if (Number(error?.status) === 404) {
      try {
        const bootstrapData = await requestJson(endpoints.publicBootstrap);
        const promotions = Array.isArray(bootstrapData.promotions) ? bootstrapData.promotions : [];
        const storedAt = await safeWrite(() => savePromotions(promotions));
        const result = {
          promotions,
          isOfflineFallback: isOfflineResponse(bootstrapData),
          cachedAt: bootstrapData.__pwa?.cachedAt || storedAt,
        };
        return withMeta ? result : promotions;
      } catch (_bootstrapError) {
        // Continue with the IndexedDB fallback below.
      }
    }

    const cached = await safeRead(readPromotions);
    if (cached?.value) {
      const result = {
        promotions: Array.isArray(cached.value) ? cached.value : [],
        isOfflineFallback: true,
        cachedAt: cached.updatedAt,
      };
      return withMeta ? result : result.promotions;
    }

    if (Number(error?.status) === 404) return withMeta
      ? { promotions: [], isOfflineFallback: false, cachedAt: "" }
      : [];
    throw error;
  }
}

export async function fetchPublicHomeHighlights() {
  if (isBrowserOffline()) {
    const cached = await safeRead(readHomeHighlights);
    if (cached?.value) {
      return {
        ...cached.value,
        isOfflineFallback: true,
        cachedAt: cached.updatedAt,
      };
    }
    throw createOfflineCacheMissError("los destacados de inicio");
  }

  try {
    const data = await requestJson(endpoints.publicHomeHighlights);
    const highlights = {
      products: Array.isArray(data.products) ? data.products : [],
      services: Array.isArray(data.services) ? data.services : [],
      promotions: Array.isArray(data.promotions) ? data.promotions : [],
    };
    const storedAt = await safeWrite(() => saveHomeHighlights(highlights));
    return {
      ...highlights,
      isOfflineFallback: isOfflineResponse(data),
      cachedAt: data.__pwa?.cachedAt || storedAt,
    };
  } catch (networkError) {
    const cached = await safeRead(readHomeHighlights);
    if (cached?.value) {
      return {
        ...cached.value,
        isOfflineFallback: true,
        cachedAt: cached.updatedAt,
      };
    }
    throw networkError;
  }
}

export async function fetchPublicProductById(id) {
  if (isBrowserOffline()) {
    const product = await safeRead(() => findPublicProduct(id));
    if (product) {
      const bundle = await safeRead(readProductsBundle);
      return { product, isOfflineFallback: true, cachedAt: bundle?.updatedAt || "" };
    }
    throw createOfflineCacheMissError(`el producto ${id}`);
  }

  try {
    const data = await requestJson(endpoints.publicProductById(id));
    const product = data.product || null;
    const storedAt = product ? await safeWrite(() => upsertPublicProduct(product)) : "";
    return {
      product,
      isOfflineFallback: isOfflineResponse(data),
      cachedAt: data.__pwa?.cachedAt || storedAt,
    };
  } catch (networkError) {
    const product = await safeRead(() => findPublicProduct(id));
    if (product) {
      const bundle = await safeRead(readProductsBundle);
      return { product, isOfflineFallback: true, cachedAt: bundle?.updatedAt || "" };
    }
    throw networkError;
  }
}

export async function fetchPublicServiceById(id) {
  if (isBrowserOffline()) {
    const service = await safeRead(() => findPublicService(id));
    if (service) {
      const bundle = await safeRead(readServicesBundle);
      return { service, isOfflineFallback: true, cachedAt: bundle?.updatedAt || "" };
    }
    throw createOfflineCacheMissError(`el servicio ${id}`);
  }

  try {
    const data = await requestJson(endpoints.publicServiceById(id));
    const service = data.service || null;
    const storedAt = service ? await safeWrite(() => upsertPublicService(service)) : "";
    return {
      service,
      isOfflineFallback: isOfflineResponse(data),
      cachedAt: data.__pwa?.cachedAt || storedAt,
    };
  } catch (networkError) {
    const service = await safeRead(() => findPublicService(id));
    if (service) {
      const bundle = await safeRead(readServicesBundle);
      return { service, isOfflineFallback: true, cachedAt: bundle?.updatedAt || "" };
    }
    throw networkError;
  }
}
