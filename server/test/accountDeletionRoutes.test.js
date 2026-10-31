const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createAccountDeletionRouter } = require("../routes/accountDeletion");

async function appFixture(t) {
  const calls = [];
  const service = {
    async requestCode(email) { calls.push(["request", email]); return { message: "Si existe la cuenta, recibirás un código." }; },
    async confirm(email, code) { calls.push(["confirm", email, code]); return { accepted: true, message: "En proceso" }; },
    async processPending() { calls.push(["process"]); },
  };
  const app = express();
  app.use(express.json());
  app.use("/api/public/account-deletion", createAccountDeletionRouter(service));
  const server = await new Promise((resolve) => { const started = app.listen(0, "127.0.0.1", () => resolve(started)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/public/account-deletion`;
  const post = (path, body) => fetch(`${base}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { base, calls, post };
}

test("la página pública y sus recursos funcionan sin sesión; GET nunca elimina", async (t) => {
  const f = await appFixture(t);
  const page = await fetch(`${f.base}?correo=cliente@example.com&codigo=12345678`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Estética Panamericana/);
  assert.equal(page.headers.get("referrer-policy"), "no-referrer");
  assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal((await fetch(`${f.base}/assets/page.js`)).status, 200);
  assert.equal((await fetch(`${f.base}/assets/style.css`)).status, 200);
  assert.equal(f.calls.length, 0);
});

test("valida tipo, correo, código y confirmación explícita antes de tocar datos", async (t) => {
  const f = await appFixture(t);
  assert.equal((await f.post("request", { correo: { $ne: null } })).status, 400);
  assert.equal((await f.post("confirm", { correo: "cliente@example.com", codigo: "12345678" })).status, 400);
  assert.equal((await f.post("confirm", { correo: "cliente@example.com", codigo: { $ne: null }, confirmacion: "ELIMINAR" })).status, 400);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.post("request", { correo: " CLIENTE@EXAMPLE.COM " })).status, 200);
  assert.deepEqual(f.calls[0], ["request", "cliente@example.com"]);
  const accepted = await f.post("confirm", { correo: "cliente@example.com", codigo: "12345678", confirmacion: "ELIMINAR" });
  assert.equal(accepted.status, 202);
  assert.equal((await accepted.json()).accepted, true);
  assert.deepEqual(f.calls[1], ["confirm", "cliente@example.com", "12345678"]);
});

test("limita intentos repetidos desde una misma dirección", async (t) => {
  const f = await appFixture(t);
  for (let count = 0; count < 40; count++) await f.post("confirm", {});
  const limited = await f.post("confirm", {});
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "900");
  assert.equal(f.calls.length, 0);
});
