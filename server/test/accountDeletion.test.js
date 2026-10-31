const test = require("node:test");
const assert = require("node:assert/strict");
const { createAccountDeletionService } = require("../utils/accountDeletion");

// In-memory models: these tests never load .env, connect to MongoDB or call providers.
function fixture() {
  const rows = {
    User: [
      { _id: "c1", role: "client", accountStatus: "active", correo: "cliente@example.com", firebaseUid: "firebase-c1" },
      { _id: "c2", role: "client", accountStatus: "active", correo: "otro@example.com" },
      { _id: "admin", role: "admin", accountStatus: "active", correo: "admin@example.com" },
    ],
    Request: [],
    Payment: [{ _id: "p1", userId: "c1", comprobantePublicId: "proof-c1" }, { _id: "p2", userId: "c2", comprobantePublicId: "proof-c2" }],
    Sale: [{ _id: "v1", clientPaymentId: "p1", cliente: "Cliente uno", total: 500 }, { _id: "v2", clientPaymentId: "p2", cliente: "Otro", total: 200 }],
    Appointment: [{ _id: "a1", userId: "c1" }, { _id: "a2", userId: "c2" }],
    Notification: [{ _id: "n1", userId: "c1" }, { _id: "n2", userId: "c2" }],
    AccessToken: [{ _id: "t1", userId: "c1" }, { _id: "t2", userId: "c2" }],
    AlexaCode: [{ _id: "x1", userId: "c1" }, { _id: "x2", userId: "c2" }],
  };
  let clock = Date.UTC(2026, 9, 30);
  let count = 12345677;
  let failDelete = false;
  let providerFailure = false;
  let fileRemoved = () => {};
  const sent = [];
  const removedFiles = [];
  const removedFirebaseUsers = [];
  function matches(row, query) {
    return Object.entries(query).every(([key, value]) => {
      const actual = row[key];
      if (value && typeof value === "object" && !(value instanceof Date)) {
        return Object.entries(value).every(([operator, expected]) => {
          if (operator === "$eq") return actual === expected;
          if (operator === "$ne") return actual !== expected;
          if (operator === "$gt") return actual > expected;
          if (operator === "$lt") return actual < expected;
          if (operator === "$lte") return actual <= expected;
          if (operator === "$in") return expected.includes(actual);
          throw new Error(`Unsupported test operator ${operator}`);
        });
      }
      return actual === value;
    });
  }
  function update(row, mutation, inserting = false) {
    if (inserting) Object.assign(row, mutation.$setOnInsert);
    Object.assign(row, mutation.$set);
    for (const [key, amount] of Object.entries(mutation.$inc || {})) row[key] = (row[key] || 0) + amount;
    for (const key of Object.keys(mutation.$unset || {})) delete row[key];
  }
  const query = (value) => ({
    select() { return this; }, session() { return this; },
    then(resolve, reject) { return Promise.resolve(structuredClone(value)).then(resolve, reject); },
  });
  const models = Object.fromEntries(Object.keys(rows).map((name) => [name, {
    findOne: (filter) => query(rows[name].find((row) => matches(row, filter)) || null),
    find: (filter) => query(rows[name].filter((row) => matches(row, filter))),
    async updateOne(filter, mutation, options = {}) {
      let row = rows[name].find((candidate) => matches(candidate, filter));
      if (!row && options.upsert) {
        row = { _id: `request-${++count}`, status: "verification", attempts: 0, nextCodeAt: new Date(0), nextAttemptAt: new Date(0), leaseUntil: new Date(0), cleanupAttempts: 0, proofPublicIds: [], paymentIds: [] };
        update(row, mutation, true);
        rows[name].push(row);
        return { modifiedCount: 0, upsertedCount: 1 };
      }
      if (!row) return { modifiedCount: 0 };
      update(row, mutation);
      return { modifiedCount: 1 };
    },
    async findOneAndUpdate(filter, mutation) {
      const row = rows[name].find((candidate) => matches(candidate, filter));
      if (!row) return null;
      update(row, mutation);
      return structuredClone(row);
    },
    async updateMany(filter, mutation) {
      rows[name].filter((row) => matches(row, filter)).forEach((row) => update(row, mutation));
    },
    async deleteOne(filter) {
      const index = rows[name].findIndex((row) => matches(row, filter));
      if (index >= 0) rows[name].splice(index, 1);
      return { deletedCount: index >= 0 ? 1 : 0 };
    },
    async deleteMany(filter) {
      if (name === "Payment" && failDelete) throw new Error("Simulated DB failure");
      rows[name] = rows[name].filter((row) => !matches(row, filter));
    },
  }]));
  const service = createAccountDeletionService({
    ...models,
    connection: { async transaction(work) {
      const snapshot = structuredClone(rows);
      try { return await work({}); } catch (error) { Object.assign(rows, snapshot); throw error; }
    } },
    secret: () => "test-only-secret", now: () => new Date(clock),
    randomCode: () => String(++count).padStart(8, "0"),
    sendEmail: async (message) => sent.push(message),
    getFirebaseAuth: () => ({ async deleteUser(uid) {
      if (removedFirebaseUsers.includes(uid)) throw Object.assign(new Error("Already deleted"), { code: "auth/user-not-found" });
      removedFirebaseUsers.push(uid);
    } }),
    cloudinary: { isConfigured: true, uploader: { async destroy(id) {
      if (providerFailure) throw new Error("Simulated provider outage");
      removedFiles.push(id);
      fileRemoved(id);
      return { result: "ok" };
    } } },
  });
  return { service, rows, sent, removedFiles, removedFirebaseUsers,
    code: () => sent.at(-1).htmlContent.match(/letter-spacing:4px">(\d{8})/)[1],
    advance: (ms) => { clock += ms; },
    failDatabase: (value) => { failDelete = value; },
    failProvider: (value) => { providerFailure = value; },
    onFileRemoved: (callback) => { fileRemoved = callback; },
  };
}

test("solicitar un código no borra datos; nunca expone existencia ni admite personal", async () => {
  const f = fixture();
  const active = await f.service.requestCode("cliente@example.com");
  const missing = await f.service.requestCode("nadie@example.com");
  const staff = await f.service.requestCode("admin@example.com");
  assert.deepEqual(active, missing);
  assert.deepEqual(active, staff);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].to.email, "cliente@example.com");
  assert.equal(f.rows.User[0].accountStatus, "active");
  assert.equal(f.rows.Appointment.length, 2);
  assert.ok(!JSON.stringify(f.rows.Request).includes(f.code()));
  await assert.rejects(f.service.confirm("admin@example.com", f.code()));
});

test("los reenvíos respetan la espera y un código nuevo invalida el anterior", async () => {
  const f = fixture();
  await f.service.requestCode("cliente@example.com");
  const old = f.code();
  await f.service.requestCode("cliente@example.com");
  assert.equal(f.sent.length, 1);
  f.advance(61_000);
  await f.service.requestCode("cliente@example.com");
  assert.equal(f.sent.length, 2);
  await assert.rejects(f.service.confirm("cliente@example.com", old));
  await f.service.confirm("cliente@example.com", f.code());
  assert.equal(f.rows.User[0].accountStatus, "inactive");
});

test("un código vencido o cinco intentos incorrectos no permiten eliminar", async () => {
  const expired = fixture();
  await expired.service.requestCode("cliente@example.com");
  expired.advance(15 * 60_000 + 1);
  await assert.rejects(expired.service.confirm("cliente@example.com", expired.code()));
  const locked = fixture();
  await locked.service.requestCode("cliente@example.com");
  for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(locked.service.confirm("cliente@example.com", "00000000"));
  await assert.rejects(locked.service.confirm("cliente@example.com", locked.code()));
  assert.equal(locked.rows.Request[0].attempts, 5);
  assert.equal(locked.rows.User[0].accountStatus, "active");
});

test("la confirmación solo se consume una vez y borra únicamente al cliente verificado", async () => {
  const f = fixture();
  await f.service.requestCode("cliente@example.com");
  const code = f.code();
  assert.equal((await f.service.confirm("cliente@example.com", code)).accepted, true);
  await assert.rejects(f.service.confirm("cliente@example.com", code));
  assert.equal(f.rows.Request[0].expiresAt, undefined);
  assert.equal(f.rows.Request[0].codeHash, undefined);
  await f.service.processPending();
  assert.deepEqual(f.rows.User.map((row) => row._id), ["c2", "admin"]);
  for (const name of ["Appointment", "Payment", "Notification", "AccessToken", "AlexaCode"]) {
    assert.equal(f.rows[name].length, 1);
    assert.equal(f.rows[name][0].userId, "c2");
  }
  assert.deepEqual(f.removedFiles, ["proof-c1"]);
  assert.deepEqual(f.removedFirebaseUsers, ["firebase-c1"]);
  assert.deepEqual(f.rows.Sale[0], { _id: "v1", clientPaymentId: null, cliente: "Cliente eliminado", total: 500 });
  assert.equal(f.rows.Sale[1].cliente, "Otro");
  assert.equal(f.rows.Request.length, 0);
});

test("la cola persiste si falla un proveedor y un reintento completa la eliminación", async () => {
  const f = fixture();
  await f.service.requestCode("cliente@example.com");
  await f.service.confirm("cliente@example.com", f.code());
  f.failProvider(true);
  await f.service.processPending();
  assert.equal(f.rows.Request[0].status, "pending");
  assert.equal(f.rows.User[0].accountStatus, "inactive");
  assert.equal(f.rows.Payment.length, 2);
  f.failProvider(false);
  f.advance(61_000);
  await f.service.processPending();
  assert.equal(f.rows.Request.length, 0);
  assert.ok(!f.rows.User.some((row) => row._id === "c1"));
});

test("la transacción revierte todos los borrados si falla la base de datos", async () => {
  const f = fixture();
  await f.service.requestCode("cliente@example.com");
  await f.service.confirm("cliente@example.com", f.code());
  f.failDatabase(true);
  await f.service.processPending();
  assert.equal(f.rows.User.length, 3);
  assert.equal(f.rows.Appointment.length, 2);
  assert.equal(f.rows.Sale[0].cliente, "Cliente uno");
  assert.equal(f.rows.Request[0].status, "pending");
  f.failDatabase(false);
  f.advance(61_000);
  await f.service.processPending();
  assert.equal(f.rows.Request.length, 0);
});

test("si la cuenta cambió de rol o fue reactivada, no borra sus datos", async () => {
  const f = fixture();
  await f.service.requestCode("cliente@example.com");
  await f.service.confirm("cliente@example.com", f.code());
  f.rows.User[0].role = "admin";
  await f.service.processPending();
  assert.equal(f.rows.Payment.length, 2);
  assert.equal(f.rows.User.length, 3);
  assert.equal(f.removedFirebaseUsers.length, 0);
});

test("incluye comprobantes y ventas que terminaron después de confirmar", async () => {
  const f = fixture();
  await f.service.requestCode("cliente@example.com");
  await f.service.confirm("cliente@example.com", f.code());
  f.rows.Payment.push({ _id: "p3", userId: "c1", comprobantePublicId: "late-proof" });
  f.rows.Sale.push({ _id: "v3", clientPaymentId: "p3", cliente: "Cliente uno", total: 100 });
  await f.service.processPending();
  assert.ok(f.removedFiles.includes("late-proof"));
  assert.equal(f.rows.Sale[2].cliente, "Cliente eliminado");
  assert.equal(f.rows.Sale[2].clientPaymentId, null);
  assert.equal(f.rows.Request.length, 0);
});

test("un comprobante que aparece durante la limpieza se elimina en el reintento", async () => {
  const f = fixture();
  await f.service.requestCode("cliente@example.com");
  await f.service.confirm("cliente@example.com", f.code());
  f.onFileRemoved(() => {
    f.onFileRemoved(() => {});
    f.rows.Payment.push({ _id: "p3", userId: "c1", comprobantePublicId: "late-proof" });
    f.rows.Sale.push({ _id: "v3", clientPaymentId: "p3", cliente: "Cliente uno", total: 100 });
  });
  await f.service.processPending();
  assert.equal(f.rows.Request[0].status, "pending");
  assert.ok(f.rows.User.some((row) => row._id === "c1"));
  f.advance(61_000);
  await f.service.processPending();
  assert.ok(f.removedFiles.includes("late-proof"));
  assert.equal(f.rows.Sale[2].cliente, "Cliente eliminado");
  assert.equal(f.rows.Request.length, 0);
});
