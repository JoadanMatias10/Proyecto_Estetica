const crypto = require("node:crypto");

const DEFAULT_API_URL = "https://proyecto-estetica-3dnx.onrender.com/api";
const APP_RESET_URL = "esteticapanamericana:///public/reset-password";
// Callback registrado para Expo Go en la red de desarrollo de este proyecto.
// En otras redes se configura MOBILE_PASSWORD_RESET_EXPO_HOSTS (host:puerto, separados por comas).
const REGISTERED_EXPO_HOSTS = "25.25.25.109:8081";
const LINK_EXPIRATION_MS = 2 * 60 * 60 * 1000;

function normalizeMobileResetUrl(value = APP_RESET_URL) {
  const url = new URL(String(value || APP_RESET_URL));
  if (url.username || url.password || url.search || url.hash) throw new Error("Retorno movil invalido.");
  const appPath = `${url.hostname}${url.pathname}`.replace(/^\/+/, "");
  const nativeApp = url.protocol === "esteticapanamericana:" && !url.port && appPath === "public/reset-password";
  const expoHosts = new Set(String(process.env.MOBILE_PASSWORD_RESET_EXPO_HOSTS || REGISTERED_EXPO_HOSTS)
    .split(",").map((host) => host.trim()).filter(Boolean));
  const expoGo = ["exp:", "exps:"].includes(url.protocol) &&
    expoHosts.has(url.host) && url.pathname === "/--/public/reset-password";
  if (!nativeApp && !expoGo) throw new Error("El enlace de retorno movil no esta autorizado.");
  return url.toString();
}

function signature(payload) {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET no configurado.");
  return crypto.createHmac("sha256", process.env.AUTH_SECRET)
    .update(`mobile-password-reset:${payload}`).digest("base64url");
}

function buildMobilePasswordResetEmailUrl(token, mobileResetUrl) {
  const target = new URL(normalizeMobileResetUrl(mobileResetUrl));
  target.searchParams.set("token", String(token));
  const payload = Buffer.from(JSON.stringify({
    target: target.toString(), expiresAt: Date.now() + LINK_EXPIRATION_MS,
  })).toString("base64url");
  const base = String(process.env.PUBLIC_API_BASE_URL || DEFAULT_API_URL).replace(/\/+$/, "");
  const link = new URL(`${base}/public/reset-password/mobile`);
  link.searchParams.set("link", `${payload}.${signature(payload)}`);
  return link.toString();
}

function resolveMobilePasswordResetTarget(link) {
  try {
    if (typeof link !== "string" || link.length > 4096) return null;
    const parts = link.split(".");
    if (parts.length !== 2) return null;
    const [payload, signed] = parts;
    const expected = Buffer.from(signature(payload));
    const actual = Buffer.from(signed);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) return null;
    const target = new URL(data.target);
    const token = target.searchParams.get("token");
    if (!token) return null;
    target.searchParams.delete("token");
    normalizeMobileResetUrl(target.toString());
    target.searchParams.set("token", token);
    return target.toString();
  } catch {
    return null;
  }
}

function buildMobilePasswordResetPage(target, nonce) {
  const href = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Abrir Estética Panamericana</title>
    <style>body{font-family:system-ui,sans-serif;background:#fff9fc;color:#292b32;margin:0;display:grid;min-height:100dvh;place-items:center}main{max-width:360px;padding:32px;text-align:center}a{display:inline-block;background:#a32662;color:white;padding:16px 24px;border-radius:24px;text-decoration:none;font-weight:600}p{line-height:1.6}</style>
    </head><body><main><h1>Continúa en la aplicación</h1>
    <p>Abriendo Estética Panamericana para restablecer tu contraseña.</p>
    <a id="open-app" href="${href}">Abrir aplicación</a>
    <p>Si no se abre automáticamente, pulsa el botón.</p></main>
    <script nonce="${nonce}">window.location.replace(document.getElementById('open-app').href);</script>
    </body></html>`;
}

module.exports = {
  normalizeMobileResetUrl, buildMobilePasswordResetEmailUrl,
  resolveMobilePasswordResetTarget, buildMobilePasswordResetPage,
};
