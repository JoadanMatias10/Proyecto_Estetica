const crypto = require("node:crypto");

const CODE_LIFETIME_MS = 15 * 60 * 1000;
const CODE_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const GENERIC_REQUEST_MESSAGE = "Si existe una cuenta de cliente con ese correo, recibirás un código de eliminación. Revisa también spam. El código vence en 15 minutos.";
const PENDING_MESSAGE = "La eliminación fue confirmada. Tu acceso quedó desactivado y tus datos se eliminarán automáticamente. Si un proveedor no responde, el proceso se reintentará.";

class AccountDeletionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function codeDigest(userId, code, secret) {
  if (!secret) throw new Error("AUTH_SECRET no configurado");
  return crypto.createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");
}

function codesMatch(expected, received) {
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(received, "hex");
  return left.length === 32 && right.length === 32 && crypto.timingSafeEqual(left, right);
}

function createAccountDeletionService({
  connection, User, Request, Payment, Sale, Appointment, Notification, AccessToken, AlexaCode,
  cloudinary, getFirebaseAuth, sendEmail,
  now = () => new Date(),
  secret = () => process.env.AUTH_SECRET,
  randomCode = () => String(crypto.randomInt(0, 100_000_000)).padStart(8, "0"),
}) {
  async function requestCode(email) {
    const user = await User.findOne({ correo: { $eq: email }, role: "client", accountStatus: { $ne: "inactive" } });
    if (!user) return { message: GENERIC_REQUEST_MESSAGE };
    const instant = now();
    // A unique userId prevents multiple simultaneous requests bypassing the cooldown.
    await Request.updateOne({ userId: user._id }, { $setOnInsert: { userId: user._id } }, { upsert: true });
    const code = randomCode();
    const record = await Request.findOneAndUpdate({
      userId: user._id, status: "verification", nextCodeAt: { $lte: instant },
    }, { $set: {
      codeHash: codeDigest(user._id, code, secret()), attempts: 0,
      expiresAt: new Date(instant.getTime() + CODE_LIFETIME_MS),
      nextCodeAt: new Date(instant.getTime() + CODE_COOLDOWN_MS),
    } }, { new: true });
    if (!record) return { message: GENERIC_REQUEST_MESSAGE };
    try {
      await sendEmail({
        to: { email: user.correo },
        subject: "Confirma la eliminación de tu cuenta de Estética Panamericana",
        htmlContent: `<html lang="es"><body><h1>Eliminar cuenta de Estética Panamericana</h1><p>Tu código de confirmación es:</p><p style="font-size:32px;font-weight:bold;letter-spacing:4px">${code}</p><p>Vence en 15 minutos. Escríbelo en la app o en la página donde solicitaste eliminar tu cuenta. La eliminación es permanente y también cancela tus próximas citas.</p><p>No compartas este código. Si no hiciste esta solicitud, ignora este mensaje: tu cuenta seguirá activa.</p></body></html>`,
      });
    } catch (error) {
      // Keep the same response for unknown accounts and delivery failures.
      // No addresses, verification codes or credentials are written to logs.
      console.error("No se pudo entregar el código de eliminación.", error?.code || "EMAIL_DELIVERY_FAILED");
      await Request.updateOne({ _id: record._id, status: "verification", codeHash: record.codeHash }, {
        $set: { codeHash: "", nextCodeAt: instant },
      });
    }
    return { message: GENERIC_REQUEST_MESSAGE };
  }

  async function confirm(email, code) {
    const invalid = () => new AccountDeletionError("El código no es válido o venció. Solicita uno nuevo.");
    const user = await User.findOne({ correo: { $eq: email }, role: "client", accountStatus: { $ne: "inactive" } });
    if (!user) throw invalid();
    const instant = now();
    // Increment outside the transaction so incorrect attempts cannot roll back.
    const record = await Request.findOneAndUpdate({
      userId: user._id, status: "verification",
      expiresAt: { $gt: instant }, attempts: { $lt: MAX_CODE_ATTEMPTS },
    }, { $inc: { attempts: 1 } }, { new: true });
    if (!record || !codesMatch(record.codeHash, codeDigest(user._id, code, secret()))) throw invalid();

    await connection.transaction(async (session) => {
      const payments = await Payment.find({ userId: user._id }).select("_id comprobantePublicId").session(session);
      const claimed = await Request.updateOne({
        _id: record._id, status: "verification", codeHash: record.codeHash,
        expiresAt: { $gt: now() }, attempts: { $lte: MAX_CODE_ATTEMPTS },
      }, {
        $set: {
          status: "pending", nextAttemptAt: instant, leaseUntil: new Date(0),
          firebaseUid: user.firebaseUid || "",
          proofPublicIds: [...new Set(payments.map((item) => item.comprobantePublicId).filter(Boolean))],
          paymentIds: payments.map((item) => item._id),
        },
        $unset: { codeHash: 1, expiresAt: 1 },
      }, { session });
      if (claimed.modifiedCount !== 1) throw invalid();
      const disabled = await User.updateOne({ _id: user._id, role: "client", accountStatus: { $ne: "inactive" } }, {
        $set: { accountStatus: "inactive" },
      }, { session });
      if (disabled.modifiedCount !== 1) throw invalid();
    });
    return { accepted: true, message: PENDING_MESSAGE };
  }

  async function processNext() {
    const instant = now();
    const record = await Request.findOneAndUpdate({
      status: "pending", nextAttemptAt: { $lte: instant }, leaseUntil: { $lte: instant },
    }, { $set: { leaseUntil: new Date(instant.getTime() + 10 * 60 * 1000) }, $inc: { cleanupAttempts: 1 } }, { new: true });
    if (!record) return false;
    try {
      const account = await User.findOne({ _id: record.userId });
      if (account && (account.role !== "client" || account.accountStatus !== "inactive")) {
        throw new Error("ACCOUNT_DELETION_STATE_CHANGED");
      }
      // Include payments completed by a request already in flight when access was disabled.
      // Keep earlier file IDs too, so a retry still removes files whose DB row was removed.
      const payments = await Payment.find({ userId: record.userId }).select("_id comprobantePublicId");
      const paymentIds = new Map(record.paymentIds.map((id) => [String(id), id]));
      for (const payment of payments) paymentIds.set(String(payment._id), payment._id);
      record.paymentIds = [...paymentIds.values()];
      record.proofPublicIds = [...new Set([...record.proofPublicIds, ...payments.map((item) => item.comprobantePublicId).filter(Boolean)])];
      await Request.updateOne({ _id: record._id, status: "pending" }, {
        $set: { paymentIds: record.paymentIds, proofPublicIds: record.proofPublicIds },
      });
      // External operations are idempotent and run before the final DB transaction.
      // The account remains inactive until every provider has removed its data.
      if (record.firebaseUid) {
        try {
          await getFirebaseAuth().deleteUser(record.firebaseUid);
        } catch (error) {
          if (error?.code !== "auth/user-not-found") throw error;
        }
      }
      if (record.proofPublicIds.length && !cloudinary.isConfigured) throw new Error("CLOUDINARY_UNAVAILABLE");
      for (const publicId of record.proofPublicIds) {
        const result = await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: "image" });
        if (!["ok", "not found"].includes(result?.result)) throw new Error("CLOUDINARY_DELETE_FAILED");
      }
      await connection.transaction(async (session) => {
        const filter = { userId: record.userId };
        const current = await User.findOne({ _id: record.userId }).session(session);
        if (current && (current.role !== "client" || current.accountStatus !== "inactive")) {
          throw new Error("ACCOUNT_DELETION_STATE_CHANGED");
        }
        const latestPayments = await Payment.find(filter).select("_id comprobantePublicId").session(session);
        if (latestPayments.some((item) => item.comprobantePublicId && !record.proofPublicIds.includes(item.comprobantePublicId))) {
          // Preserve the account and retry with the new file instead of orphaning it.
          throw new Error("ACCOUNT_DELETION_FILES_CHANGED");
        }
        const linkedPaymentIds = new Map(record.paymentIds.map((id) => [String(id), id]));
        for (const payment of latestPayments) linkedPaymentIds.set(String(payment._id), payment._id);
        await User.deleteOne({ _id: record.userId, role: "client", accountStatus: "inactive" }, { session });
        // Preserve accounting totals and stock history, removing the customer link.
        await Sale.updateMany({ clientPaymentId: { $in: [...linkedPaymentIds.values()] } }, {
          $set: { cliente: "Cliente eliminado", clientPaymentId: null },
        }, { session });
        for (const Model of [Notification, Appointment, Payment, AccessToken, AlexaCode]) {
          await Model.deleteMany(filter, { session });
        }
        await Request.deleteOne({ _id: record._id, status: "pending" }, { session });
      });
    } catch (error) {
      console.error("La eliminación de cuenta se reintentará.", error?.code || error?.name || "CLEANUP_FAILED");
      await Request.updateOne({ _id: record._id, status: "pending" }, { $set: {
        nextAttemptAt: new Date(now().getTime() + Math.min(record.cleanupAttempts, 60) * 60 * 1000),
        leaseUntil: new Date(0),
      } });
    }
    return true;
  }

  let running = false;
  async function processPending() {
    if (running) return;
    running = true;
    try {
      for (let count = 0; count < 20; count += 1) {
        if (!await processNext()) break;
      }
    } finally {
      running = false;
    }
  }

  return { requestCode, confirm, processPending };
}

let service;
function getAccountDeletionService() {
  if (!service) service = createAccountDeletionService({
    connection: require("mongoose").connection,
    User: require("../models/Usuario"), Request: require("../models/SolicitudEliminacionCuenta"),
    Payment: require("../models/PagoCliente"), Sale: require("../models/Venta"),
    Appointment: require("../models/Cita"), Notification: require("../models/NotificacionCliente"),
    AccessToken: require("../models/TokenAccesoCuenta"), AlexaCode: require("../models/CodigoAlexa"),
    cloudinary: require("../config/cloudinary"),
    getFirebaseAuth: require("../config/firebaseAdmin").getFirebaseAdminAuth,
    sendEmail: require("./brevo").sendTransactionalEmail,
  });
  return service;
}

function startAccountDeletionWorker() {
  const run = () => { void getAccountDeletionService().processPending().catch(() => console.error("No se pudo revisar la cola de eliminación de cuentas.")); };
  run();
  const timer = setInterval(run, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { AccountDeletionError, createAccountDeletionService, getAccountDeletionService, startAccountDeletionWorker };
