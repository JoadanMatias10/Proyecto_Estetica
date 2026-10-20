import { requestJson } from "../api";
import {
  findPublicProduct,
  findPublicService,
  readCompanyInfo,
  readHomeHighlights,
  readProductsBundle,
  readPromotions,
  readServicesBundle,
} from "./publicDataStore";
import {
  fetchPublicCompanyInfo,
  fetchPublicHomeHighlights,
  fetchPublicProductById,
  fetchPublicProductsBundle,
  fetchPublicPromotions,
  fetchPublicServiceById,
  fetchPublicServicesBundle,
} from "./publicCatalogApi";

jest.mock("../api", () => ({
  endpoints: {
    publicBootstrap: "/bootstrap",
    publicCompanyInfo: "/company-info",
    publicHomeHighlights: "/home-highlights",
    publicProductById: (id) => `/products/${id}`,
    publicProductCategories: "/product-categories",
    publicProducts: "/products",
    publicPromotions: "/promotions",
    publicServiceById: (id) => `/services/${id}`,
    publicServiceCategories: "/service-categories",
    publicServices: "/services",
  },
  requestJson: jest.fn(),
}));

jest.mock("./publicDataStore", () => ({
  findPublicProduct: jest.fn(),
  findPublicService: jest.fn(),
  readCompanyInfo: jest.fn(),
  readHomeHighlights: jest.fn(),
  readProductsBundle: jest.fn(),
  readPromotions: jest.fn(),
  readServicesBundle: jest.fn(),
  saveCompanyInfo: jest.fn(),
  saveHomeHighlights: jest.fn(),
  saveProductsBundle: jest.fn(),
  savePromotions: jest.fn(),
  saveServicesBundle: jest.fn(),
  upsertPublicProduct: jest.fn(),
  upsertPublicService: jest.fn(),
}));

const CACHED_AT = "2026-10-13T12:00:00.000Z";
const companyInfo = { nombre: "Estética Panamericana" };
const products = [{ id: "p1", nombre: "Shampoo de argán" }];
const productCategories = [{ nombre: "Cabello", subcategorias: ["Shampoo"] }];
const services = [{ id: "s1", nombre: "Corte", segmento: "Cabello" }];
const serviceCategories = [{ nombre: "Cortes", segmento: "Cabello" }];
const promotions = [{ id: "promo1", titulo: "Descuento" }];
const highlights = { products, services, promotions };

describe("publicCatalogApi offline-first", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    global.fetch = jest.fn();

    readCompanyInfo.mockResolvedValue({ value: companyInfo, updatedAt: CACHED_AT });
    readProductsBundle.mockResolvedValue({
      value: { products, categories: productCategories },
      updatedAt: CACHED_AT,
    });
    readServicesBundle.mockResolvedValue({
      value: { services, serviceCategories },
      updatedAt: CACHED_AT,
    });
    readPromotions.mockResolvedValue({ value: promotions, updatedAt: CACHED_AT });
    readHomeHighlights.mockResolvedValue({ value: highlights, updatedAt: CACHED_AT });
    findPublicProduct.mockResolvedValue(products[0]);
    findPublicService.mockResolvedValue(services[0]);
  });

  afterAll(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  });

  test("devuelve todos los conjuntos guardados sin iniciar solicitudes de red", async () => {
    await expect(fetchPublicCompanyInfo()).resolves.toEqual({
      ...companyInfo,
      __offline: true,
      __cachedAt: CACHED_AT,
    });
    await expect(fetchPublicProductsBundle()).resolves.toEqual({
      products,
      categories: productCategories,
      categoriesMap: { Cabello: ["Shampoo"] },
      isOfflineFallback: true,
      cachedAt: CACHED_AT,
    });
    await expect(fetchPublicServicesBundle()).resolves.toEqual({
      services,
      serviceCategories,
      serviceSegments: ["Cabello"],
      isOfflineFallback: true,
      cachedAt: CACHED_AT,
    });
    await expect(fetchPublicPromotions({ withMeta: true })).resolves.toEqual({
      promotions,
      isOfflineFallback: true,
      cachedAt: CACHED_AT,
    });
    await expect(fetchPublicHomeHighlights()).resolves.toEqual({
      ...highlights,
      isOfflineFallback: true,
      cachedAt: CACHED_AT,
    });
    await expect(fetchPublicProductById("p1")).resolves.toEqual({
      product: products[0],
      isOfflineFallback: true,
      cachedAt: CACHED_AT,
    });
    await expect(fetchPublicServiceById("s1")).resolves.toEqual({
      service: services[0],
      isOfflineFallback: true,
      cachedAt: CACHED_AT,
    });

    expect(requestJson).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("informa claramente cuando no existe copia local y tampoco intenta la red", async () => {
    readCompanyInfo.mockResolvedValue(null);

    await expect(fetchPublicCompanyInfo()).rejects.toMatchObject({
      name: "OfflineCacheMissError",
      code: "OFFLINE_CACHE_MISS",
      message: expect.stringContaining("no existe una copia guardada"),
    });

    expect(requestJson).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
