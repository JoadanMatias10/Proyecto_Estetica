const {
  normalizeString,
  validateEmail,
  validateName,
  validatePhone,
} = require("./validadores");

const REQUIRED_CLIENT_PROFILE_FIELDS = Object.freeze([
  "nombre",
  "apellidoPaterno",
  "telefono",
  "correo",
]);

function passesValidation(validate) {
  const errors = [];
  validate(errors);
  return errors.length === 0;
}

function getMissingClientProfileFields(user) {
  const source = user || {};
  const missing = [];

  if (!passesValidation((errors) => validateName(source.nombre, "Nombre", errors))) {
    missing.push("nombre");
  }
  if (!passesValidation((errors) => validateName(source.apellidoPaterno, "Apellido paterno", errors))) {
    missing.push("apellidoPaterno");
  }
  if (!passesValidation((errors) => validatePhone(source.telefono, errors))) {
    missing.push("telefono");
  }
  if (!passesValidation((errors) => validateEmail(source.correo, errors))) {
    missing.push("correo");
  }

  return missing;
}

function isClientProfileComplete(user) {
  return getMissingClientProfileFields(user).length === 0;
}

function hasVerifiedGoogleLink(user) {
  return Boolean(
    normalizeString(user?.firebaseUid) &&
      user?.googleLinkedAt &&
      ["google-signup", "authenticated-session"].includes(user?.googleLinkMethod) &&
      normalizeString(user?.googleLinkedEmail),
  );
}

function buildClientProfileMetadata(user) {
  const missingProfileFields = getMissingClientProfileFields(user);
  return {
    profileComplete: missingProfileFields.length === 0,
    missingProfileFields,
    googleLinked: hasVerifiedGoogleLink(user),
  };
}

module.exports = {
  REQUIRED_CLIENT_PROFILE_FIELDS,
  buildClientProfileMetadata,
  getMissingClientProfileFields,
  hasVerifiedGoogleLink,
  isClientProfileComplete,
};
