const {
  FirebaseAdminConfigurationError,
  getFirebaseAdminAuth,
} = require("../config/firebaseAdmin");
const { normalizeString } = require("./validadores");

const MAX_FIREBASE_ID_TOKEN_LENGTH = 10000;
const RECENT_GOOGLE_AUTH_MAX_AGE_SECONDS = 5 * 60;
const CLOCK_SKEW_SECONDS = 60;
const INVALID_FIREBASE_TOKEN_CODES = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/user-disabled",
]);

class GoogleAuthVerificationError extends Error {
  constructor({ code, message, status, cause = null }) {
    super(message);
    this.name = "GoogleAuthVerificationError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function validateGoogleIdentityClaims(
  decodedToken,
  {
    requireRecent = false,
    nowSeconds = Math.floor(Date.now() / 1000),
    maxAgeSeconds = RECENT_GOOGLE_AUTH_MAX_AGE_SECONDS,
  } = {},
) {
  const provider = decodedToken?.firebase?.sign_in_provider;
  const firebaseUid = normalizeString(decodedToken?.uid);
  const email = normalizeEmail(decodedToken?.email);

  if (
    provider !== "google.com" ||
    !firebaseUid ||
    !email ||
    decodedToken?.email_verified !== true
  ) {
    throw new GoogleAuthVerificationError({
      code: "GOOGLE_IDENTITY_INVALID",
      message: "La cuenta de Google no pudo verificarse.",
      status: 401,
    });
  }

  const authTime = Number(decodedToken?.auth_time);
  if (
    requireRecent &&
    (!Number.isFinite(authTime) ||
      authTime > nowSeconds + CLOCK_SKEW_SECONDS ||
      nowSeconds - authTime > maxAgeSeconds)
  ) {
    throw new GoogleAuthVerificationError({
      code: "GOOGLE_REAUTHENTICATION_REQUIRED",
      message: "Vuelve a autenticarte con Google para vincular la cuenta.",
      status: 401,
    });
  }

  return {
    authTime,
    displayName: normalizeString(decodedToken?.name),
    email,
    firebaseUid,
  };
}

async function verifyGoogleFirebaseIdToken(firebaseIdToken, options = {}) {
  const normalizedToken = normalizeString(firebaseIdToken);
  if (!normalizedToken || normalizedToken.length > MAX_FIREBASE_ID_TOKEN_LENGTH) {
    throw new GoogleAuthVerificationError({
      code: "FIREBASE_ID_TOKEN_INVALID",
      message: "Token de Firebase invalido.",
      status: 400,
    });
  }

  let decodedToken;
  try {
    decodedToken = await getFirebaseAdminAuth().verifyIdToken(normalizedToken, true);
  } catch (error) {
    if (error instanceof FirebaseAdminConfigurationError) {
      throw new GoogleAuthVerificationError({
        code: "GOOGLE_AUTH_UNAVAILABLE",
        message: "El acceso con Google no esta disponible temporalmente.",
        status: 503,
        cause: error,
      });
    }

    if (INVALID_FIREBASE_TOKEN_CODES.has(error?.code)) {
      throw new GoogleAuthVerificationError({
        code: "FIREBASE_ID_TOKEN_REJECTED",
        message: "La sesion de Google no es valida.",
        status: 401,
        cause: error,
      });
    }

    throw new GoogleAuthVerificationError({
      code: "GOOGLE_AUTH_UNAVAILABLE",
      message: "El acceso con Google no esta disponible temporalmente.",
      status: 503,
      cause: error,
    });
  }

  return validateGoogleIdentityClaims(decodedToken, options);
}

module.exports = {
  GoogleAuthVerificationError,
  RECENT_GOOGLE_AUTH_MAX_AGE_SECONDS,
  validateGoogleIdentityClaims,
  verifyGoogleFirebaseIdToken,
};
