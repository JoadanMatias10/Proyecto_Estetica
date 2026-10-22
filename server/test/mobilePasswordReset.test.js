const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeMobileResetUrl, buildMobilePasswordResetEmailUrl, resolveMobilePasswordResetTarget } = require("../utils/mobilePasswordReset");

test("solo permite la pantalla movil y los hosts registrados de Expo Go", () => {
  assert.equal(normalizeMobileResetUrl(), "esteticapanamericana:///public/reset-password");
  assert.equal(normalizeMobileResetUrl("esteticapanamericana://public/reset-password"), "esteticapanamericana://public/reset-password");
  const expo = "exp://25.25.25.109:8081/--/public/reset-password";
  assert.equal(normalizeMobileResetUrl(expo), expo);
  for (const url of ["javascript:alert(1)", "https://otro.example/public/reset-password",
    "exp://otro.example:8081/--/public/reset-password", "esteticapanamericana://public/login",
    `${expo}?token=inyectado`, "esteticapanamericana://user:password@public/reset-password"]) {
    assert.throws(() => normalizeMobileResetUrl(url));
  }
});

test("el enlace firmado rechaza alteraciones y vencimiento sin consumir el token de la cuenta", () => {
  const previousSecret = process.env.AUTH_SECRET;
  const previousNow = Date.now;
  try {
    process.env.AUTH_SECRET = "clave-solo-para-pruebas";
    const issuedAt = Date.now();
    const emailUrl = new URL(buildMobilePasswordResetEmailUrl("token-prueba"));
    const signed = emailUrl.searchParams.get("link");
    assert.equal(new URL(resolveMobilePasswordResetTarget(signed)).searchParams.get("token"), "token-prueba");
    const [payload, mac] = signed.split(".");
    const modified = JSON.parse(Buffer.from(payload, "base64url").toString());
    modified.target = "https://otro.example/";
    assert.equal(resolveMobilePasswordResetTarget(`${Buffer.from(JSON.stringify(modified)).toString("base64url")}.${mac}`), null);
    assert.equal(resolveMobilePasswordResetTarget(`${signed}.extra`), null);
    Date.now = () => issuedAt + 2 * 60 * 60 * 1000 + 1000;
    assert.equal(resolveMobilePasswordResetTarget(signed), null);
  } finally {
    Date.now = previousNow;
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});
