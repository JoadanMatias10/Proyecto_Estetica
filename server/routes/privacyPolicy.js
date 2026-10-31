const express = require("express");
const path = require("node:path");
const policy = require("../data/privacy-policy.json");
const { renderPrivacyPolicyPage } = require("../utils/privacyPolicy");

function createPrivacyPolicyRouter() {
  const router = express.Router();
  const page = renderPrivacyPolicyPage(policy);
  router.use((_req, res, next) => {
    res.set({
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    });
    next();
  });
  router.get("/", (_req, res) => res.type("html").send(page));
  router.use("/assets", express.static(path.join(__dirname, "../public/privacy-policy/assets")));
  return router;
}

module.exports = { createPrivacyPolicyRouter };
