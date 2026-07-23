const { buildWhatsAppUrl, normalizeWhatsAppNumber } = require("./whatsapp");

const DEFAULT_LOGO_URL =
  "https://res.cloudinary.com/drnhozxsk/image/upload/estetica-panamericana/logo.png";

function getTicketLogoUrl() {
  return String(process.env.LOGO_URL || "").trim() || DEFAULT_LOGO_URL;
}

function formatTicketDate(value) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(parsed);
}

function formatTicketAmount(value) {
  return `$${Number(value || 0).toFixed(2)} MXN`;
}

function buildPaymentTicketMessage(payment) {
  const source = typeof payment?.toObject === "function" ? payment.toObject() : payment || {};
  const items = Array.isArray(source.detalle) ? source.detalle : [];
  const visibleItems = items.slice(0, 15);
  const itemLines = visibleItems.map((item) => {
    const quantity = Math.max(1, Number(item?.cantidad || 1));
    const subtotal = Number(item?.subtotal || 0);
    return `- ${quantity} x ${item?.nombre || "Concepto"}: ${formatTicketAmount(subtotal)}`;
  });

  if (items.length > visibleItems.length) {
    itemLines.push(`- Y ${items.length - visibleItems.length} concepto(s) adicional(es)`);
  }

  const lines = [
    "*ESTETICA PANAMERICANA*",
    getTicketLogoUrl(),
    "*RECIBO DE PAGO*",
    "",
    `Folio: ${source._id || source.id || "No disponible"}`,
    `Fecha: ${formatTicketDate(source.revisadoAt || source.createdAt)}`,
    `Cliente: ${source.cliente?.nombre || "Cliente"}`,
    `Tipo: ${source.tipo || "Pago"}`,
    `Metodo: ${source.metodo || "No disponible"}`,
    "",
    "*Detalle:*",
    ...(itemLines.length ? itemLines : [`- ${source.concepto || "Pago registrado"}`]),
    "",
    `*Total: ${formatTicketAmount(source.total)}*`,
    `Estado: ${source.estatus || "Confirmado"}`,
  ];

  if (source.referencia) lines.push(`Referencia: ${source.referencia}`);
  if (source.saleId) lines.push(`Venta: ${source.saleId}`);
  if (source.appointmentId) lines.push(`Cita: ${source.appointmentId}`);

  lines.push("", "Gracias por confiar en Estetica Panamericana.");
  return lines.join("\n");
}

function buildPaymentTicket(payment) {
  const source = typeof payment?.toObject === "function" ? payment.toObject() : payment || {};
  const phone = source.cliente?.telefono || "";
  const message = buildPaymentTicketMessage(source);

  return {
    recipient: normalizeWhatsAppNumber(phone),
    message,
    whatsappUrl: buildWhatsAppUrl(phone, message),
  };
}

module.exports = {
  buildPaymentTicket,
  buildPaymentTicketMessage,
};
