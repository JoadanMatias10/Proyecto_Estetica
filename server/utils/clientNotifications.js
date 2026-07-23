const Appointment = require("../models/Cita");
const ClientNotification = require("../models/NotificacionCliente");
const User = require("../models/Usuario");
const { isBrevoConfigured, sendTransactionalEmail } = require("./brevo");
const { buildWhatsAppUrl, normalizeWhatsAppNumber } = require("./whatsapp");

const ACTIVE_APPOINTMENT_STATUSES = ["pendiente", "programada", "confirmada"];
const NOTIFICATION_CHANNELS = new Set(["Email", "WhatsApp", "Notificacion interna"]);
const REMINDER_MINUTES = new Map([
  ["24 horas antes", 24 * 60],
  ["12 horas antes", 12 * 60],
  ["2 horas antes", 2 * 60],
]);
const DEFAULT_REMINDER_SETTINGS = {
  anticipacion: "24 horas antes",
  canal: "Email",
};
const PREPARED_RETRY_DELAY_MS = 10 * 60 * 1000;

let schedulerTimer = null;
let schedulerRunning = false;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReminderSettings(user) {
  const settings = {
    ...DEFAULT_REMINDER_SETTINGS,
    ...(user?.reminderSettings || {}),
  };

  return {
    anticipacion: REMINDER_MINUTES.has(settings.anticipacion)
      ? settings.anticipacion
      : DEFAULT_REMINDER_SETTINGS.anticipacion,
    canal: NOTIFICATION_CHANNELS.has(settings.canal) ? settings.canal : DEFAULT_REMINDER_SETTINGS.canal,
  };
}

function getClientName(user) {
  return [user?.nombre, user?.apellidoPaterno, user?.apellidoMaterno]
    .map((value) => normalizeString(value))
    .filter(Boolean)
    .join(" ") || "Cliente";
}

function formatDateTime(value) {
  if (!value) return "fecha por confirmar";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Mexico_City",
    }).format(new Date(value));
  } catch (_error) {
    return new Date(value).toISOString();
  }
}

function buildAppointmentMessage(appointment, customMessage = "") {
  const message = normalizeString(customMessage);
  if (message) return message;

  const serviceName = normalizeString(appointment?.servicio) || "tu servicio";
  return `Hola, te recordamos tu cita para ${serviceName} el ${formatDateTime(appointment?.fechaHora)} en Estetica Panamericana.`;
}

function buildAppointmentEmailHtml({ user, appointment, messageText }) {
  const clientName = escapeHtml(getClientName(user));
  const serviceName = escapeHtml(appointment?.servicio || "Servicio");
  const dateTime = escapeHtml(formatDateTime(appointment?.fechaHora));
  const message = escapeHtml(messageText).replace(/\n/g, "<br/>");

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
      <h2 style="color:#7c3aed;margin-bottom:8px">Recordatorio de cita</h2>
      <p>Hola ${clientName},</p>
      <p>${message}</p>
      <div style="margin:18px 0;padding:14px;border:1px solid #ede9fe;border-radius:12px;background:#f5f3ff">
        <p style="margin:0"><strong>Servicio:</strong> ${serviceName}</p>
        <p style="margin:6px 0 0"><strong>Fecha y hora:</strong> ${dateTime}</p>
      </div>
      <p>Gracias por confiar en Estetica Panamericana.</p>
    </div>
  `;
}

function buildClientNotificationResponse(notification) {
  const source = typeof notification?.toObject === "function" ? notification.toObject() : notification;
  return {
    id: String(source._id),
    appointmentId: source.appointmentId ? String(source.appointmentId) : "",
    tipo: source.tipo || "recordatorio_cita",
    canal: source.canal,
    anticipacion: source.anticipacion,
    mensaje: source.mensaje,
    estado: source.estado,
    destinatario: source.destinatario || "",
    whatsappUrl: source.whatsappUrl || "",
    enviadoAt: source.enviadoAt || null,
    errorEnvio: source.errorEnvio || "",
    origen: source.origen || "manual",
    fechaObjetivo: source.fechaObjetivo,
    createdAt: source.createdAt,
  };
}

async function deliverClientAppointmentNotification({
  user,
  appointment,
  settings,
  messageText,
  origen = "manual",
  existingNotification = null,
}) {
  const reminderSettings = buildReminderSettings({ reminderSettings: settings });
  const canal = reminderSettings.canal;
  const message = buildAppointmentMessage(appointment, messageText);
  const notificationData = {
    userId: user._id,
    appointmentId: appointment?._id || null,
    tipo: "recordatorio_cita",
    canal,
    anticipacion: reminderSettings.anticipacion,
    mensaje: message,
    estado: "preparada",
    origen,
    fechaObjetivo: appointment?.fechaHora || null,
    destinatario: "",
    whatsappUrl: "",
    enviadoAt: null,
    errorEnvio: "",
  };
  const notification = existingNotification || new ClientNotification();
  notification.set(notificationData);
  await notification.save();

  if (canal === "WhatsApp") {
    const whatsappUrl = buildWhatsAppUrl(user.telefono, message);
    if (!whatsappUrl) {
      notification.estado = "fallida";
      notification.destinatario = user.telefono || "";
      notification.errorEnvio = "El cliente no tiene un telefono valido para WhatsApp.";
      await notification.save();
      return {
        ok: false,
        status: 400,
        message: "El cliente no tiene un telefono valido para WhatsApp.",
        notification,
      };
    }

    notification.estado = "lista_whatsapp";
    notification.destinatario = `+${normalizeWhatsAppNumber(user.telefono)}`;
    notification.whatsappUrl = whatsappUrl;
    await notification.save();
    return {
      ok: true,
      status: 201,
      message: "WhatsApp listo para enviar.",
      notification,
    };
  }

  if (canal === "Notificacion interna") {
    notification.estado = "enviada";
    notification.destinatario = "Notificacion interna";
    notification.enviadoAt = new Date();
    await notification.save();
    return {
      ok: true,
      status: 201,
      message: "Notificacion interna guardada.",
      notification,
    };
  }

  notification.destinatario = user.correo || "";
  if (!user.correo) {
    notification.estado = "fallida";
    notification.errorEnvio = "El cliente no tiene correo registrado.";
    await notification.save();
    return {
      ok: false,
      status: 400,
      message: "El cliente no tiene correo registrado.",
      notification,
    };
  }

  if (!isBrevoConfigured()) {
    notification.estado = "fallida";
    notification.errorEnvio = "Brevo no esta configurado en el servidor.";
    await notification.save();
    return {
      ok: false,
      status: 503,
      message: "Falta configurar Brevo para enviar correos.",
      notification,
    };
  }

  try {
    await sendTransactionalEmail({
      to: { email: user.correo, name: getClientName(user) },
      subject: "Recordatorio de cita - Estetica Panamericana",
      htmlContent: buildAppointmentEmailHtml({ user, appointment, messageText: message }),
      textContent: message,
    });

    notification.estado = "enviada";
    notification.enviadoAt = new Date();
    await notification.save();
    return {
      ok: true,
      status: 201,
      message: "Correo enviado correctamente.",
      notification,
    };
  } catch (error) {
    notification.estado = "fallida";
    notification.errorEnvio = error.message || "No fue posible enviar el correo.";
    await notification.save();
    return {
      ok: false,
      status: 502,
      message: notification.errorEnvio,
      notification,
    };
  }
}

async function processDueAppointmentReminders() {
  const now = new Date();
  const users = await User.find({
    role: "client",
    accountStatus: "active",
    "notificationPreferences.appointmentReminders": { $ne: false },
  })
    .select("nombre apellidoPaterno apellidoMaterno correo telefono reminderSettings")
    .lean();

  for (const user of users) {
    const settings = buildReminderSettings(user);
    const minutes = REMINDER_MINUTES.get(settings.anticipacion) || REMINDER_MINUTES.get(DEFAULT_REMINDER_SETTINGS.anticipacion);
    const reminderWindowEnd = new Date(now.getTime() + minutes * 60 * 1000);
    const appointments = await Appointment.find({
      userId: user._id,
      estado: { $in: ACTIVE_APPOINTMENT_STATUSES },
      fechaHora: { $gt: now, $lte: reminderWindowEnd },
    })
      .select("userId servicio fechaHora estado")
      .lean();

    for (const appointment of appointments) {
      const notificationIdentity = {
        userId: user._id,
        appointmentId: appointment._id,
        tipo: "recordatorio_cita",
        canal: settings.canal,
        anticipacion: settings.anticipacion,
        origen: "automatico",
      };
      const delivered = await ClientNotification.findOne({
        ...notificationIdentity,
        estado: { $in: ["enviada", "lista_whatsapp"] },
      })
        .select("_id")
        .lean();

      if (delivered) continue;

      const retryable = await ClientNotification.findOne({
        ...notificationIdentity,
        estado: { $in: ["fallida", "preparada"] },
      }).sort({ updatedAt: -1 });
      const preparedRecently =
        retryable?.estado === "preparada" &&
        Date.now() - new Date(retryable.updatedAt || retryable.createdAt).getTime() <
          PREPARED_RETRY_DELAY_MS;

      if (preparedRecently) continue;

      await deliverClientAppointmentNotification({
        user,
        appointment,
        settings,
        origen: "automatico",
        existingNotification: retryable,
      });
    }
  }
}

async function triggerDueAppointmentReminderScan() {
  if (schedulerRunning) return false;
  schedulerRunning = true;
  try {
    await processDueAppointmentReminders();
    return true;
  } catch (error) {
    console.error("Error procesando recordatorios de cliente:", error);
    return false;
  } finally {
    schedulerRunning = false;
  }
}

function startClientNotificationScheduler() {
  if (schedulerTimer || String(process.env.CLIENT_NOTIFICATION_SCHEDULER || "").toLowerCase() === "off") {
    return schedulerTimer;
  }

  const configuredInterval = Number(process.env.CLIENT_NOTIFICATION_INTERVAL_MS || 5 * 60 * 1000);
  const intervalMs = Number.isFinite(configuredInterval) && configuredInterval >= 60000
    ? configuredInterval
    : 5 * 60 * 1000;

  schedulerTimer = setInterval(triggerDueAppointmentReminderScan, intervalMs);
  if (typeof schedulerTimer.unref === "function") {
    schedulerTimer.unref();
  }
  void triggerDueAppointmentReminderScan();
  return schedulerTimer;
}

module.exports = {
  buildClientNotificationResponse,
  buildReminderSettings,
  deliverClientAppointmentNotification,
  processDueAppointmentReminders,
  startClientNotificationScheduler,
  triggerDueAppointmentReminderScan,
};
