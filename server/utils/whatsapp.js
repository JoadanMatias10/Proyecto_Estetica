function normalizeWhatsAppNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  const countryCode =
    String(process.env.WHATSAPP_COUNTRY_CODE || "52").replace(/\D/g, "") || "52";

  if (digits.length === 10) return `${countryCode}${digits}`;
  if (digits.startsWith(countryCode) && digits.length >= 12 && digits.length <= 15) {
    return digits;
  }
  if (digits.length >= 11 && digits.length <= 15) return digits;

  return "";
}

function buildWhatsAppUrl(phone, message) {
  const normalizedPhone = normalizeWhatsAppNumber(phone);
  if (!normalizedPhone) return "";
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(String(message || ""))}`;
}

module.exports = {
  buildWhatsAppUrl,
  normalizeWhatsAppNumber,
};
