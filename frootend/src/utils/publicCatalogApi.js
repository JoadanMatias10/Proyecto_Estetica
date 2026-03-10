import { endpoints, requestJson } from "../api";

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
  const data = await requestJson(endpoints.publicCompanyInfo);
  return data.companyInfo || null;
}

export async function fetchPublicProductsBundle() {
  const [productsData, categoriesData] = await Promise.all([
    requestJson(endpoints.publicProducts),
    requestJson(endpoints.publicProductCategories),
  ]);
  const products = Array.isArray(productsData.products) ? productsData.products : [];
  const categories = Array.isArray(categoriesData.categories) ? categoriesData.categories : [];
  return {
    products,
    categories,
    categoriesMap: buildProductCategoriesMap(categories),
  };
}

export async function fetchPublicServicesBundle() {
  const [servicesData, categoriesData] = await Promise.all([
    requestJson(endpoints.publicServices),
    requestJson(endpoints.publicServiceCategories),
  ]);
  const services = Array.isArray(servicesData.services) ? servicesData.services : [];
  const serviceCategories = Array.isArray(categoriesData.categories) ? categoriesData.categories : [];
  return {
    services,
    serviceCategories,
    serviceSegments: getServiceSegments(serviceCategories, services),
  };
}
