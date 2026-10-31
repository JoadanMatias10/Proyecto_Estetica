const express = require("express");
const path = require("node:path");
const { AccountDeletionError, getAccountDeletionService } = require("../utils/accountDeletion");

function createAccountDeletionRouter(service = getAccountDeletionService()) {
  const router = express.Router();
  const limits = new Map();
  router.use((_req, res, next) => {
    res.set({
      "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'none'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    });
    next();
  });
  router.get("/", (_req, res) => res.sendFile(path.join(__dirname, "../public/account-deletion/index.html")));
  router.use("/assets", express.static(path.join(__dirname, "../public/account-deletion/assets")));
  router.post(["/request", "/confirm"], async (req, res, next) => {
    const instant = Date.now();
    for (const [key, value] of limits) if (value.until <= instant) limits.delete(key);
    const key = `${req.ip}:${req.path}`;
    const limit = limits.get(key) || { count: 0, until: instant + 15 * 60_000 };
    if (limit.count >= 40 || (!limits.has(key) && limits.size >= 4096)) {
      res.set("Retry-After", "900");
      return res.status(429).json({ error: "Demasiados intentos. Espera 15 minutos e inténtalo nuevamente." });
    }
    limit.count += 1;
    limits.set(key, limit);
    const email = typeof req.body?.correo === "string" ? req.body.correo.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
      return res.status(400).json({ error: "Ingresa el correo electrónico de tu cuenta." });
    }
    try {
      if (req.path === "/request") return res.json(await service.requestCode(email));
      const code = typeof req.body?.codigo === "string" ? req.body.codigo.trim() : "";
      if (!/^\d{8}$/.test(code) || req.body?.confirmacion !== "ELIMINAR") {
        return res.status(400).json({ error: "Escribe el código de 8 dígitos y confirma la eliminación." });
      }
      const result = await service.confirm(email, code);
      res.status(202).json(result);
      void service.processPending().catch(() => console.error("No se pudo iniciar la eliminación de cuentas."));
    } catch (error) {
      if (error instanceof AccountDeletionError) return res.status(error.status).json({ error: error.message });
      return next(error);
    }
  });
  return router;
}

module.exports = { createAccountDeletionRouter };
