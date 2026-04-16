const normalizeBaseUrl = (value) => {
  // Some local Windows setups intercept localhost:5000; a loopback alias still reaches the Express server.
  //const base = (value || "http://127.0.0.2:5000").trim().replace(/\/+$/, "");
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
  publicServiceById: (id) => buildUrl(`/public/services/${id}`),
  publicServiceCategories: buildUrl("/public/service-categories"),
  publicPromotions: buildUrl("/public/promotions"),
  publicHomeHighlights: buildUrl("/public/home-highlights"),
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
  adminHomeHighlights: buildUrl("/admin/home-highlights"),
  adminStats: (period = "Mes") => buildUrl(`/admin/stats?period=${encodeURIComponent(period)}`),
  adminReports: ({ tipo = "Todos", desde = "", hasta = "" } = {}) =>
    buildUrl(`/admin/reports?tipo=${encodeURIComponent(tipo)}&desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`),
  adminPromotions: buildUrl("/admin/promotions"),
  adminPromotionById: (id) => buildUrl(`/admin/promotions/${id}`),
  adminSales: ({ desde = "", hasta = "" } = {}) =>
    buildUrl(`/admin/sales?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`),
  adminSalesPredictive: buildUrl("/admin/sales/predictive"),
  adminSaleCancel: (id) => buildUrl(`/admin/sales/${encodeURIComponent(id)}/cancel`),
  adminInventoryMovements: ({ action = "Todos" } = {}) =>
    buildUrl(`/admin/inventory/movements?action=${encodeURIComponent(action)}`),
  adminInventoryAlerts: (threshold = 5) =>
    buildUrl(`/admin/inventory/alerts?threshold=${encodeURIComponent(threshold)}`),
  adminStaff: buildUrl("/admin/staff"),
  adminStaffById: (id) => buildUrl(`/admin/staff/${id}`),
  adminStaffInvite: (id) => buildUrl(`/admin/staff/${id}/invite`),
  adminBackupCollections: buildUrl("/admin/respaldos/colecciones"),
  adminBackupHistory: buildUrl("/admin/respaldos/historial"),
  adminBackupCreate: buildUrl("/admin/respaldos/crear"),
  adminBackupSchedule: buildUrl("/admin/respaldos/programacion"),
  adminBackupDownload: (id) => buildUrl(`/admin/respaldos/descargar/${encodeURIComponent(id || "")}`),
  adminDatabaseMonitor: buildUrl("/admin/database-monitor"),
  adminDatabaseMonitorSummary: buildUrl("/admin/database-monitor/summary"),
  adminDatabaseMonitorActivity: buildUrl("/admin/database-monitor/activity"),
  adminDatabaseMonitorHealth: buildUrl("/admin/database-monitor/health"),
  adminDatabaseMonitorExplainProducts: buildUrl("/admin/database-monitor/explain/products"),
  adminDatabaseMonitorExplainCitas: buildUrl("/admin/database-monitor/explain/citas"),
  adminDatabaseMonitorExplainServices: buildUrl("/admin/database-monitor/explain/services"),
  adminDatabaseMonitorStream: buildUrl("/admin/database-monitor/stream"),
};

export async function requestJson(url, options = {}) {
  const { method = "GET", body, token, headers = {}, signal } = options;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const response = await fetch(url, {
    method,
    signal,
    headers: {
      ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
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
