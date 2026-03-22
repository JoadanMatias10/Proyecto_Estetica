const normalizeBaseUrl = (value) => {
  const base = (value || "http://localhost:5000").trim().replace(/\/+$/, "");
  if (base.endsWith("/api")) return base;
  return `${base}/api`;
};

export const API_BASE_URL = normalizeBaseUrl(process.env.REACT_APP_API_URL);

const buildUrl = (path) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const endpoints = {
  register: buildUrl("/public/register"),
  login: buildUrl("/public/login"),
  recover: buildUrl("/public/recover"),
  validateInvite: (token) => buildUrl(`/public/invite/validate?token=${encodeURIComponent(token || "")}`),
  acceptInvite: buildUrl("/public/invite/accept"),
  validateResetPassword: (token) => buildUrl(`/public/reset-password/validate?token=${encodeURIComponent(token || "")}`),
  resetPassword: buildUrl("/public/reset-password"),
  adminLogin: buildUrl("/admin/login"),
  adminMe: buildUrl("/admin/me"),

  publicBootstrap: buildUrl("/public/bootstrap"),
  publicCompanyInfo: buildUrl("/public/company-info"),
  publicProducts: buildUrl("/public/products"),
  publicProductById: (id) => buildUrl(`/public/products/${id}`),
  publicProductCategories: buildUrl("/public/product-categories"),
  publicProductBrands: buildUrl("/public/product-brands"),
  publicServices: buildUrl("/public/services"),
  publicServiceCategories: buildUrl("/public/service-categories"),
  publicCarousel: buildUrl("/public/carousel"),

  adminProducts: buildUrl("/admin/products"),
  adminProductsExport: buildUrl("/admin/products/export"),
  adminProductsImport: buildUrl("/admin/products/import"),
  adminProductById: (id) => buildUrl(`/admin/products/${id}`),
  adminProductCategories: buildUrl("/admin/product-categories"),
  adminProductCategoryById: (id) => buildUrl(`/admin/product-categories/${id}`),
  adminProductBrands: buildUrl("/admin/product-brands"),
  adminProductBrandById: (id) => buildUrl(`/admin/product-brands/${id}`),
  adminServices: buildUrl("/admin/services"),
  adminServiceById: (id) => buildUrl(`/admin/services/${id}`),
  adminServiceCategories: buildUrl("/admin/service-categories"),
  adminServiceCategoryById: (id) => buildUrl(`/admin/service-categories/${id}`),
  adminCompanyInfo: buildUrl("/admin/company-info"),
  adminCarousel: buildUrl("/admin/carousel"),
  adminCarouselById: (id) => buildUrl(`/admin/carousel/${id}`),
  adminCarouselReorder: buildUrl("/admin/carousel/reorder"),
  adminStats: (period = "Mes") => buildUrl(`/admin/stats?period=${encodeURIComponent(period)}`),
  adminReports: ({ tipo = "Todos", desde = "", hasta = "" } = {}) =>
    buildUrl(`/admin/reports?tipo=${encodeURIComponent(tipo)}&desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`),
  adminPromotions: buildUrl("/admin/promotions"),
  adminPromotionById: (id) => buildUrl(`/admin/promotions/${id}`),
  adminSales: ({ desde = "", hasta = "" } = {}) =>
    buildUrl(`/admin/sales?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`),
  adminInventoryMovements: ({ action = "Todos" } = {}) =>
    buildUrl(`/admin/inventory/movements?action=${encodeURIComponent(action)}`),
  adminInventoryAlerts: (threshold = 10) =>
    buildUrl(`/admin/inventory/alerts?threshold=${encodeURIComponent(threshold)}`),
  adminStaff: buildUrl("/admin/staff"),
  adminStaffById: (id) => buildUrl(`/admin/staff/${id}`),
  adminStaffInvite: (id) => buildUrl(`/admin/staff/${id}/invite`),
  adminBackupCollections: buildUrl("/admin/respaldos/colecciones"),
  adminBackupHistory: buildUrl("/admin/respaldos/historial"),
  adminBackupCreate: buildUrl("/admin/respaldos/crear"),
  adminBackupSchedule: buildUrl("/admin/respaldos/programacion"),
  adminBackupDownload: (id) => buildUrl(`/admin/respaldos/descargar/${encodeURIComponent(id || "")}`),
};

export async function requestJson(url, options = {}) {
  const { method = "GET", body, token, headers = {} } = options;

  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.errors) && data.errors.length
      ? data.errors[0]
      : data.error || data.message || response.statusText || "No fue posible procesar la solicitud.";
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export default API_BASE_URL;
