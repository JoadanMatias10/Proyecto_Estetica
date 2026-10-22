const test = require("node:test");
const assert = require("node:assert/strict");

test("el correo movil tiene un solo boton HTTPS que abre la app; el web conserva su formulario", async () => {
  const brevoPath = require.resolve("../utils/brevo");
  const accountAccessPath = require.resolve("../utils/accountAccess");
  const previousBrevo = require.cache[brevoPath];
  const previousAccountAccess = require.cache[accountAccessPath];
  const previousBaseUrl = process.env.APP_BASE_URL;
  const previousSecret = process.env.AUTH_SECRET;
  let sent;

  try {
    process.env.APP_BASE_URL = "https://proyecto-estetica.vercel.app";
    process.env.AUTH_SECRET = "secreto-solo-para-pruebas";
    require.cache[brevoPath] = {
      id: brevoPath,
      filename: brevoPath,
      loaded: true,
      exports: { sendTransactionalEmail: async (message) => { sent = message; return { messageId: "mock" }; } },
    };
    delete require.cache[accountAccessPath];
    const { sendPasswordResetEmail } = require("../utils/accountAccess");
    await sendPasswordResetEmail(
      { correo: "prueba@example.com", nombre: "Prueba" },
      "token-prueba+seguro",
      { openInMobileApp: true },
    );

    const links = Array.from(sent.htmlContent.matchAll(/<a\s+href="([^"]+)"/g), (match) => match[1]);
    assert.equal(links.length, 1);
    const url = new URL(links[0]);
    assert.equal(url.origin, "https://proyecto-estetica-3dnx.onrender.com");
    assert.equal(url.pathname, "/api/public/reset-password/mobile");
    const { resolveMobilePasswordResetTarget } = require("../utils/mobilePasswordReset");
    const destination = new URL(resolveMobilePasswordResetTarget(url.searchParams.get("link")));
    assert.equal(destination.protocol, "esteticapanamericana:");
    assert.equal(destination.searchParams.get("token"), "token-prueba+seguro");
    assert.doesNotMatch(sent.htmlContent, /¿El botón no funciona\?|esteticapanamericana:\/\//);
    assert.equal(sent.to.email, "prueba@example.com");
    await sendPasswordResetEmail({ correo: "prueba@example.com" }, "token-web");
    const webLinks = Array.from(sent.htmlContent.matchAll(/<a\s+href="([^"]+)"/g), (match) => match[1]);
    assert.equal(webLinks.length, 2);
    assert.ok(webLinks.every((href) => new URL(href).pathname === "/restablecer-contrasena"));
    assert.ok(webLinks.every((href) => new URL(href).origin === "https://proyecto-estetica.vercel.app"));
  } finally {
    if (previousBrevo) require.cache[brevoPath] = previousBrevo;
    else delete require.cache[brevoPath];
    if (previousAccountAccess) require.cache[accountAccessPath] = previousAccountAccess;
    else delete require.cache[accountAccessPath];
    if (previousBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previousBaseUrl;
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("recuperar desde la API genera el boton y permite cambiar la contrasena una sola vez", async () => {
  const express = require("express");
  const crypto = require("node:crypto");
  const { verifyPassword } = require("../utils/contrasena");
  const userPath = require.resolve("../models/Usuario");
  const tokenPath = require.resolve("../models/TokenAccesoCuenta");
  const routePath = require.resolve("../routes/publico");
  const paths = [userPath, tokenPath, routePath];
  const previousModules = paths.map((file) => require.cache[file]);
  const envNames = ["APP_BASE_URL", "BREVO_API_KEY", "BREVO_SENDER_EMAIL", "AUTH_SECRET"];
  const previousEnv = envNames.map((name) => process.env[name]);
  const originalFetch = global.fetch;
  const user = {
    _id: "111111111111111111111111", correo: "prueba@example.com", nombre: "Prueba",
    role: "client", accountStatus: "active", save: async () => {},
  };
  let record;
  let sent;
  let server;
  try {
    process.env.APP_BASE_URL = "https://proyecto-estetica.vercel.app";
    process.env.AUTH_SECRET = "secreto-solo-para-pruebas";
    process.env.BREVO_API_KEY = "clave-de-prueba";
    process.env.BREVO_SENDER_EMAIL = "remitente@example.com";
    const mocks = [{
      findOne: async ({ correo }) => correo.$eq === user.correo ? user : null,
      findById: async (id) => id === user._id ? user : null,
    }, {
      deleteMany: async () => { record = null; },
      create: async (data) => {
        record = { ...data, usedAt: null, save: async () => {} };
        return record;
      },
      findOne: async (query) => record && record.tokenHash === query.tokenHash &&
        record.type === query.type && !record.usedAt && record.expiresAt > query.expiresAt.$gt ? record : null,
    }];
    [userPath, tokenPath].forEach((file, index) => {
      require.cache[file] = { id: file, filename: file, loaded: true, exports: mocks[index] };
    });
    delete require.cache[routePath];
    global.fetch = async (url, options) => {
      if (url === "https://api.brevo.com/v3/smtp/email") {
        sent = JSON.parse(options.body);
        return Response.json({ messageId: "correo-simulado" });
      }
      assert.equal(new URL(url).hostname, "127.0.0.1", "La prueba no debe usar servicios reales");
      return originalFetch(url, options);
    };
    const app = express();
    app.use(express.json());
    app.use("/api/public", require("../routes/publico"));
    server = await new Promise((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const api = `http://127.0.0.1:${server.address().port}/api/public`;
    const recovered = await fetch(`${api}/recover`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo: user.correo, origen: "movil", mobileResetUrl: "exp://25.25.25.109:8081/--/public/reset-password" }),
    });
    assert.equal(recovered.status, 200);
    const links = Array.from(sent.htmlContent.matchAll(/<a\s+href="([^"]+)"/g), (match) => match[1]);
    assert.equal(links.length, 1);
    const link = new URL(links[0]);
    assert.equal(link.origin, "https://proyecto-estetica-3dnx.onrender.com");
    assert.equal(link.pathname, "/api/public/reset-password/mobile");
    assert.doesNotMatch(sent.htmlContent, /¿El botón no funciona\?|esteticapanamericana:\/\//);
    const page = await fetch(`http://127.0.0.1:${server.address().port}${link.pathname}${link.search}`);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("referrer-policy"), "no-referrer");
    assert.equal(page.headers.get("cache-control"), "no-store");
    const pageHtml = await page.text();
    const destination = new URL(pageHtml.match(/id="open-app" href="([^"]+)"/)[1]);
    assert.equal(destination.protocol, "exp:");
    assert.equal(destination.host, "25.25.25.109:8081");
    assert.equal(destination.pathname, "/--/public/reset-password");
    assert.doesNotMatch(pageHtml, /<form|restablecer-contrasena/);
    const token = destination.searchParams.get("token");
    assert.equal(crypto.createHash("sha256").update(token).digest("hex"), record.tokenHash);
    assert.equal((await fetch(`${api}/reset-password/validate?token=${token}`)).status, 200);
    const badReturn = await fetch(`${api}/recover`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo: user.correo, origen: "movil", mobileResetUrl: "https://otro-sitio.example" }),
    });
    assert.equal(badReturn.status, 400);
    assert.equal((await fetch(`${api}/reset-password/validate?token=${token}`)).status, 200);
    const reset = await fetch(`${api}/reset-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: "NuevaClave123!" }),
    });
    assert.equal(reset.status, 200);
    assert.equal(verifyPassword("NuevaClave123!", user.passwordSalt, user.passwordHash), true);
    assert.equal((await fetch(`${api}/reset-password/validate?token=${token}`)).status, 404);
  } finally {
    global.fetch = originalFetch;
    if (server) await new Promise((resolve) => server.close(resolve));
    paths.forEach((file, index) => {
      if (previousModules[index]) require.cache[file] = previousModules[index];
      else delete require.cache[file];
    });
    envNames.forEach((name, index) => {
      if (previousEnv[index] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[index];
    });
  }
});
