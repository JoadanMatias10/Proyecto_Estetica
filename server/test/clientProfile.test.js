const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildClientProfileMetadata,
  getMissingClientProfileFields,
  hasVerifiedGoogleLink,
  isClientProfileComplete,
} = require("../utils/clientProfile");

function buildCompleteClient(overrides = {}) {
  return {
    nombre: "Laura",
    apellidoPaterno: "Aguilar",
    telefono: "5512345678",
    correo: "laura@example.com",
    firebaseUid: "firebase-client-1",
    googleLinkedAt: new Date("2026-10-12T12:00:00.000Z"),
    googleLinkedEmail: "laura@example.com",
    googleLinkMethod: "google-signup",
    ...overrides,
  };
}

test("detecta un perfil de cliente completo", () => {
  const client = buildCompleteClient();

  assert.deepEqual(getMissingClientProfileFields(client), []);
  assert.equal(isClientProfileComplete(client), true);
  assert.deepEqual(buildClientProfileMetadata(client), {
    profileComplete: true,
    missingProfileFields: [],
    googleLinked: true,
  });
});

test("reporta solamente los datos obligatorios faltantes", () => {
  const client = buildCompleteClient({ apellidoPaterno: "", telefono: "123" });

  assert.deepEqual(getMissingClientProfileFields(client), ["apellidoPaterno", "telefono"]);
  assert.equal(isClientProfileComplete(client), false);
});

test("no considera verificada una vinculacion sin metadata de auditoria", () => {
  assert.equal(
    hasVerifiedGoogleLink(buildCompleteClient({ googleLinkedAt: null })),
    false,
  );
  assert.equal(
    hasVerifiedGoogleLink(buildCompleteClient({ googleLinkMethod: "desconocido" })),
    false,
  );
});

