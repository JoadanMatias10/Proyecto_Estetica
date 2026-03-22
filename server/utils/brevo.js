const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function readEnv(name, required = true) {
  const value = String(process.env[name] || "").trim();
  if (!value && required) {
    throw new Error(`Falta configurar ${name} en el entorno.`);
  }
  return value;
}

function normalizeRecipients(to) {
  const input = Array.isArray(to) ? to : [to];
  const recipients = input
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "string") {
        const email = entry.trim();
        return email ? { email } : null;
      }

      const email = String(entry.email || "").trim();
      const name = String(entry.name || "").trim();
      if (!email) return null;

      return name ? { email, name } : { email };
    })
    .filter(Boolean);

  if (!recipients.length) {
    throw new Error("Debes indicar al menos un destinatario.");
  }

  return recipients;
}

function getDefaultReplyTo() {
  const email = readEnv("BREVO_REPLY_TO_EMAIL", false);
  const name = readEnv("BREVO_REPLY_TO_NAME", false);

  if (!email) return null;
  return name ? { email, name } : { email };
}

function getSender() {
  const email = readEnv("BREVO_SENDER_EMAIL");
  const name = readEnv("BREVO_SENDER_NAME", false) || "Estetica Panamericana";
  return { email, name };
}

function isBrevoConfigured() {
  return Boolean(
    String(process.env.BREVO_API_KEY || "").trim() &&
      String(process.env.BREVO_SENDER_EMAIL || "").trim()
  );
}

async function sendTransactionalEmail({
  to,
  subject,
  htmlContent,
  textContent,
  replyTo,
}) {
  if (typeof fetch !== "function") {
    throw new Error("El entorno actual no soporta fetch para enviar correos con Brevo.");
  }

  const trimmedSubject = String(subject || "").trim();
  if (!trimmedSubject) {
    throw new Error("El asunto del correo es obligatorio.");
  }

  const payload = {
    sender: getSender(),
    to: normalizeRecipients(to),
    subject: trimmedSubject,
  };

  const html = String(htmlContent || "").trim();
  const text = String(textContent || "").trim();
  if (!html && !text) {
    throw new Error("Debes enviar contenido HTML o texto para el correo.");
  }

  if (html) {
    payload.htmlContent = html;
  } else {
    payload.textContent = text;
  }

  const resolvedReplyTo = replyTo || getDefaultReplyTo();
  if (resolvedReplyTo) {
    payload.replyTo = resolvedReplyTo;
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": readEnv("BREVO_API_KEY"),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const details =
      data?.message ||
      data?.code ||
      data?.error ||
      `Brevo respondio con estado ${response.status}.`;
    throw new Error(`No fue posible enviar correo con Brevo. ${details}`);
  }

  return data;
}

module.exports = {
  isBrevoConfigured,
  sendTransactionalEmail,
};
