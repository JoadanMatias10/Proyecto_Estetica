const CART_KEY = "client.cart.v1";
const PAYMENTS_KEY = "client.payments.v1";
const REMINDER_KEY = "client.reminder.settings.v1";
const NOTIFICATION_PREFS_KEY = "client.notification.preferences.v1";

export const DEFAULT_REMINDER_SETTINGS = {
  anticipacion: "24 horas antes",
  canal: "Email",
};

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  appointmentReminders: true,
  promotions: true,
  appointmentChanges: true,
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
    window.dispatchEvent(new CustomEvent("client-state-change", { detail: { key } }));
  } catch (_error) {
    // Local storage can fail in private windows; the UI keeps working in memory.
  }
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getStoredClientUser() {
  const user = safeRead("user", null);
  return user && typeof user === "object" ? user : null;
}

export function getClientToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("token") || "";
}

export function saveStoredClientUser(user) {
  safeWrite("user", user);
}

export function getClientCart() {
  const records = safeRead(CART_KEY, []);
  if (!Array.isArray(records)) return [];

  return records
    .filter((item) => item && item.id)
    .map((item) => ({
      id: String(item.id),
      nombre: item.nombre || "Producto",
      precio: toNumber(item.precio),
      cantidad: Math.max(1, Math.floor(toNumber(item.cantidad, 1))),
      imagen: item.imagen || "",
      categoria: item.categoria || "",
      marca: item.marca || "",
      presentacion: item.presentacion || "",
      addedAt: item.addedAt || new Date().toISOString(),
    }));
}

export function saveClientCart(items) {
  safeWrite(CART_KEY, Array.isArray(items) ? items : []);
}

export function addProductToCart(product, quantity = 1) {
  const productId = product?.id || product?._id;
  if (!productId) return getClientCart();

  const cart = getClientCart();
  const normalizedQuantity = Math.max(1, Math.floor(toNumber(quantity, 1)));
  const existingIndex = cart.findIndex((item) => String(item.id) === String(productId));

  if (existingIndex >= 0) {
    cart[existingIndex] = {
      ...cart[existingIndex],
      cantidad: cart[existingIndex].cantidad + normalizedQuantity,
    };
  } else {
    cart.push({
      id: String(productId),
      nombre: product.nombre || "Producto",
      precio: toNumber(product.precio),
      cantidad: normalizedQuantity,
      imagen: product.imagen || "",
      categoria: product.categoria || "",
      marca: product.marca || "",
      presentacion: product.presentacion || product.contenido || "",
      addedAt: new Date().toISOString(),
    });
  }

  saveClientCart(cart);
  return cart;
}

export function updateCartItemQuantity(productId, quantity) {
  const normalizedQuantity = Math.max(1, Math.floor(toNumber(quantity, 1)));
  const cart = getClientCart().map((item) =>
    String(item.id) === String(productId) ? { ...item, cantidad: normalizedQuantity } : item
  );
  saveClientCart(cart);
  return cart;
}

export function removeCartItem(productId) {
  const cart = getClientCart().filter((item) => String(item.id) !== String(productId));
  saveClientCart(cart);
  return cart;
}

export function clearClientCart() {
  saveClientCart([]);
}

export function getCartSummary(items = getClientCart()) {
  return items.reduce(
    (summary, item) => {
      const quantity = Math.max(1, Math.floor(toNumber(item.cantidad, 1)));
      const subtotal = toNumber(item.precio) * quantity;
      return {
        totalItems: summary.totalItems + quantity,
        subtotal: summary.subtotal + subtotal,
      };
    },
    { totalItems: 0, subtotal: 0 }
  );
}

export function getClientPayments() {
  const records = safeRead(PAYMENTS_KEY, []);
  if (!Array.isArray(records)) return [];

  return normalizeClientPayments(records);
}

function normalizeClientPayments(records) {
  if (!Array.isArray(records)) return [];

  return records
    .filter((payment) => payment && payment.id)
    .map((payment) => ({
      id: payment.id,
      tipo: payment.tipo || "Producto",
      concepto: payment.concepto || "Movimiento",
      total: toNumber(payment.total),
      metodo: payment.metodo || "Tarjeta",
      fecha: payment.fecha || new Date().toISOString().slice(0, 10),
      estatus: payment.estatus || "Pagado",
      detalle: Array.isArray(payment.detalle) ? payment.detalle : [],
      cliente: payment.cliente || {},
      referencia: payment.referencia || "",
      comprobanteUrl: payment.comprobanteUrl || "",
      notas: payment.notas || "",
      createdAt: payment.createdAt || new Date().toISOString(),
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function saveClientPayments(payments) {
  const normalized = normalizeClientPayments(payments);
  safeWrite(PAYMENTS_KEY, normalized);
  return normalized;
}

export function cacheClientPayment(payment) {
  if (!payment?.id) return getClientPayments();
  const payments = getClientPayments().filter((item) => String(item.id) !== String(payment.id));
  return saveClientPayments([payment, ...payments]);
}

export function addClientPayment(payment) {
  const nextPayment = {
    id: generateId("P"),
    tipo: payment.tipo || "Producto",
    concepto: payment.concepto || "Movimiento",
    total: toNumber(payment.total),
    metodo: payment.metodo || "Tarjeta",
    fecha: new Date().toISOString().slice(0, 10),
    estatus: payment.estatus || "Pagado",
    detalle: Array.isArray(payment.detalle) ? payment.detalle : [],
    createdAt: new Date().toISOString(),
  };
  const payments = [nextPayment, ...getClientPayments()];
  safeWrite(PAYMENTS_KEY, payments);
  return nextPayment;
}

export function getReminderSettings() {
  return {
    ...DEFAULT_REMINDER_SETTINGS,
    ...safeRead(REMINDER_KEY, DEFAULT_REMINDER_SETTINGS),
  };
}

export function saveReminderSettings(settings) {
  safeWrite(REMINDER_KEY, {
    ...DEFAULT_REMINDER_SETTINGS,
    ...(settings || {}),
  });
}

export function getNotificationPreferences() {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...safeRead(NOTIFICATION_PREFS_KEY, DEFAULT_NOTIFICATION_PREFERENCES),
  };
}

export function saveNotificationPreferences(preferences) {
  safeWrite(NOTIFICATION_PREFS_KEY, {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(preferences || {}),
  });
}
