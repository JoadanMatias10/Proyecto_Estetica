const crypto = require("crypto");
const { hashPassword } = require("./contrasena");
const { sendTransactionalEmail } = require("./brevo");

const INTERNAL_USER_ROLES = new Set(["admin", "stylist"]);
const STAFF_ROLE_TO_USER_ROLE = {
  Administrador: "admin",
  Estilista: "stylist",
};
const USER_ROLE_TO_STAFF_ROLE = {
  admin: "Administrador",
  stylist: "Estilista",
};
const ACCOUNT_STATUS = {
  ACTIVE: "active",
  PENDING: "pending",
  INACTIVE: "inactive",
};
const INVITE_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 7;
const PASSWORD_RESET_EXPIRATION_MS = 1000 * 60 * 60 * 2;

function mapStaffRoleToUserRole(staffRole) {
  return STAFF_ROLE_TO_USER_ROLE[String(staffRole || "").trim()] || null;
}

function mapUserRoleToStaffRole(userRole) {
  return USER_ROLE_TO_STAFF_ROLE[String(userRole || "").trim()] || "";
}

function isInternalUserRole(role) {
  return INTERNAL_USER_ROLES.has(String(role || "").trim());
}

function canUseAdminPanel(role) {
  return isInternalUserRole(role);
}

function normalizeAppBaseUrl(value) {
  return String(value || "http://localhost:3000").trim().replace(/\/+$/, "");
}

function buildAppUrl(pathname, params = {}) {
  const normalizedBaseUrl = normalizeAppBaseUrl(process.env.APP_BASE_URL);
  const normalizedPath = String(pathname || "/").startsWith("/")
    ? String(pathname || "/")
    : `/${String(pathname || "")}`;
  const url = new URL(`${normalizedBaseUrl}${normalizedPath}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function hashAccessToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function createRawAccessToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createPlaceholderCredentials() {
  const tempPassword = `Tmp-${crypto.randomBytes(24).toString("hex")}Aa1!`;
  return hashPassword(tempPassword);
}

async function revokeAccessTokens(AccountAccessToken, { userId, type = "" }) {
  if (!userId) return;
  const query = { userId };
  if (type) query.type = type;
  await AccountAccessToken.deleteMany(query);
}

async function issueAccessToken(AccountAccessToken, { userId, type, expiresInMs, createdByUserId = null }) {
  await revokeAccessTokens(AccountAccessToken, { userId, type });

  const rawToken = createRawAccessToken();
  const tokenHash = hashAccessToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInMs);

  const record = await AccountAccessToken.create({
    userId,
    createdByUserId,
    type,
    tokenHash,
    expiresAt,
  });

  return { rawToken, record };
}

async function getValidAccessToken(AccountAccessToken, { token, type }) {
  const tokenHash = hashAccessToken(token);
  if (!tokenHash) return null;

  return AccountAccessToken.findOne({
    tokenHash,
    type,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
}

async function consumeAccessToken(AccountAccessToken, { token, type }) {
  const record = await getValidAccessToken(AccountAccessToken, { token, type });
  if (!record) return null;

  record.usedAt = new Date();
  await record.save();
  return record;
}

function buildInviteEmail(user, token) {
  const roleLabel = mapUserRoleToStaffRole(user.role) || "Personal";
  const link = buildAppUrl("/activar-cuenta", { token });

  return {
    subject: "Activa tu cuenta de Estetica Panamericana",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <h1 style="margin-bottom: 16px;">Bienvenido a Estetica Panamericana</h1>
        <p>Hola ${user.nombre || "equipo"},</p>
        <p>Se creo una cuenta para ti con el rol de <strong>${roleLabel}</strong>.</p>
        <p>Para activar tu acceso y definir tu contraseña, entra al siguiente enlace:</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="display: inline-block; padding: 12px 18px; background: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700;">
            Activar cuenta
          </a>
        </p>
        <p>Si el boton no abre, copia y pega este enlace en tu navegador:</p>
        <p style="word-break: break-all;">${link}</p>
        <p>Este enlace vence en 7 dias.</p>
      </div>
    `,
    textContent: `Hola ${user.nombre || "equipo"}, activa tu cuenta aqui: ${link}. Este enlace vence en 7 dias.`,
  };
}

function buildPasswordResetEmail(user, token) {
  const link = buildAppUrl("/restablecer-contrasena", { token });

  return {
    subject: "Restablece tu contraseña de Estetica Panamericana",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <h1 style="margin-bottom: 16px;">Restablecer contraseña</h1>
        <p>Hola ${user.nombre || "usuario"},</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
        <p>Para continuar, entra al siguiente enlace:</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="display: inline-block; padding: 12px 18px; background: #0f766e; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700;">
            Restablecer contraseña
          </a>
        </p>
        <p>Si el boton no abre, copia y pega este enlace en tu navegador:</p>
        <p style="word-break: break-all;">${link}</p>
        <p>Este enlace vence en 2 horas.</p>
      </div>
    `,
    textContent: `Hola ${user.nombre || "usuario"}, restablece tu contraseña aqui: ${link}. Este enlace vence en 2 horas.`,
  };
}

async function sendInviteEmail(user, token) {
  const email = buildInviteEmail(user, token);
  return sendTransactionalEmail({
    to: { email: user.correo, name: user.nombre || "" },
    subject: email.subject,
    htmlContent: email.htmlContent,
  });
}

async function sendPasswordResetEmail(user, token) {
  const email = buildPasswordResetEmail(user, token);
  return sendTransactionalEmail({
    to: { email: user.correo, name: user.nombre || "" },
    subject: email.subject,
    htmlContent: email.htmlContent,
  });
}

module.exports = {
  ACCOUNT_STATUS,
  INVITE_EXPIRATION_MS,
  PASSWORD_RESET_EXPIRATION_MS,
  canUseAdminPanel,
  consumeAccessToken,
  createPlaceholderCredentials,
  getValidAccessToken,
  isInternalUserRole,
  issueAccessToken,
  mapStaffRoleToUserRole,
  mapUserRoleToStaffRole,
  revokeAccessTokens,
  sendInviteEmail,
  sendPasswordResetEmail,
};
