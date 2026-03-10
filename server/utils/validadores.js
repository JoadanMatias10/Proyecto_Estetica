const EMAIL_REGEX =
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PHONE_REGEX = /^\d{10}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const SERVICE_OPTIONS = ["Corte", "Coloración", "Tratamiento"];

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateRequired(value, field, errors) {
  if (!value || !normalizeString(value)) {
    errors.push(`${field} es obligatorio.`);
    return false;
  }
  return true;
}

function validateName(value, field, errors) {
  if (!validateRequired(value, field, errors)) return false;
  const normalized = normalizeString(value);
  if (!/^[A-Za-zÁÉÍÓÚÑáéíóúñ\s'-]{2,60}$/.test(normalized)) {
    errors.push(`${field} debe contener solo letras y tener al menos 2 caracteres.`);
    return false;
  }
  return true;
}

function validateEmail(value, errors) {
  if (!validateRequired(value, "Correo", errors)) return false;
  const normalized = normalizeString(value).toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    errors.push("Correo con formato inválido.");
    return false;
  }
  return true;
}

function validatePhone(value, errors) {
  if (!validateRequired(value, "Teléfono", errors)) return false;
  const normalized = normalizeString(value);
  if (!PHONE_REGEX.test(normalized)) {
    errors.push("Teléfono debe tener 10 dígitos numéricos.");
    return false;
  }
  return true;
}

function validatePassword(value, errors) {
  if (!validateRequired(value, "Contraseña", errors)) return false;
  if (!PASSWORD_REGEX.test(value)) {
    errors.push(
      "Contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y símbolo."
    );
    return false;
  }
  return true;
}

function validateDateTime(dateValue, timeValue, errors) {
  if (!validateRequired(dateValue, "Fecha", errors)) return null;
  if (!validateRequired(timeValue, "Hora", errors)) return null;
  const date = normalizeString(dateValue);
  const time = normalizeString(timeValue);
  const combined = new Date(`${date}T${time}`);
  if (Number.isNaN(combined.getTime())) {
    errors.push("Fecha u hora inválida.");
    return null;
  }
  const now = new Date();
  if (combined < now) {
    errors.push("La fecha y hora deben ser futuras.");
    return null;
  }
  return combined;
}

function validateService(value, errors) {
  if (!validateRequired(value, "Servicio", errors)) return false;
  const normalized = normalizeString(value);
  if (!SERVICE_OPTIONS.includes(normalized)) {
    errors.push("Servicio no válido.");
    return false;
  }
  return true;
}

function validateNotes(value, errors) {
  if (!value) return true;
  const normalized = normalizeString(value);
  if (normalized.length > 200) {
    errors.push("Notas no pueden exceder 200 caracteres.");
    return false;
  }
  return true;
}

module.exports = {
  normalizeString,
  validateName,
  validateEmail,
  validatePhone,
  validatePassword,
  validateDateTime,
  validateService,
  validateNotes,
};