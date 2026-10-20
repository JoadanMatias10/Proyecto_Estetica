const test = require("node:test");
const assert = require("node:assert/strict");

const {
  GoogleAuthVerificationError,
  validateGoogleIdentityClaims,
} = require("../utils/googleAuth");

function buildGoogleClaims(overrides = {}) {
  return {
    uid: " firebase-client-1 ",
    email: "LAURA@EXAMPLE.COM",
    email_verified: true,
    name: " Laura Aguilar ",
    auth_time: 1_000,
    firebase: { sign_in_provider: "google.com" },
    ...overrides,
  };
}

function hasGoogleError(code) {
  return (error) => error instanceof GoogleAuthVerificationError && error.code === code;
}

test("acepta claims verificados emitidos por el proveedor Google", () => {
  const identity = validateGoogleIdentityClaims(buildGoogleClaims());

  assert.deepEqual(identity, {
    authTime: 1_000,
    displayName: "Laura Aguilar",
    email: "laura@example.com",
    firebaseUid: "firebase-client-1",
  });
});

test("rechaza proveedores distintos y correos no verificados", () => {
  assert.throws(
    () => validateGoogleIdentityClaims(buildGoogleClaims({ firebase: { sign_in_provider: "password" } })),
    hasGoogleError("GOOGLE_IDENTITY_INVALID"),
  );
  assert.throws(
    () => validateGoogleIdentityClaims(buildGoogleClaims({ email_verified: false })),
    hasGoogleError("GOOGLE_IDENTITY_INVALID"),
  );
});

test("exige una autenticacion reciente para vincular cuentas", () => {
  const recentIdentity = validateGoogleIdentityClaims(buildGoogleClaims({ auth_time: 9_800 }), {
    requireRecent: true,
    nowSeconds: 10_000,
    maxAgeSeconds: 300,
  });
  assert.equal(recentIdentity.authTime, 9_800);

  assert.throws(
    () => validateGoogleIdentityClaims(buildGoogleClaims({ auth_time: 9_000 }), {
      requireRecent: true,
      nowSeconds: 10_000,
      maxAgeSeconds: 300,
    }),
    hasGoogleError("GOOGLE_REAUTHENTICATION_REQUIRED"),
  );
  assert.throws(
    () => validateGoogleIdentityClaims(buildGoogleClaims({ auth_time: 10_061 }), {
      requireRecent: true,
      nowSeconds: 10_000,
      maxAgeSeconds: 300,
    }),
    hasGoogleError("GOOGLE_REAUTHENTICATION_REQUIRED"),
  );
});

