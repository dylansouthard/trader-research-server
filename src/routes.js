const express = require("express");
const { toIsoUtc, clampInt } = require("./util");

function apiKeyPlaceholder(req, res, next) {
  // v0: no auth. Keep middleware placeholder for future API key checks.
  next();
}

function ok(res, data, meta = {}) {
  return res.json({ ok: true, data, meta });
}

function badRequest(res, message) {
  return res.status(400).json({ ok: false, error: message });
}

function buildRouter(db) {
  const router = express.Router();
  router.use(apiKeyPlaceholder);

  router.get("/health", (req, res) => {
    ok(res, [{ status: "up" }], { service: "research-server" });
  });

  router.get("/docs/latest", (req, res) => {
    const limit = clampInt(req.query.limit || 100, 1, 1000);
    const rows = db.listLatest(limit);
    return ok(res, rows, { limit, returned: rows.length });
  });

  router.get("/docs", (req, res) => {
    const since = String(req.query.since || "").trim();
    if (!since) return badRequest(res, "missing required query param: since");

    const sinceIso = toIsoUtc(since);
    if (!sinceIso) return badRequest(res, "invalid since ISO timestamp");

    const limit = clampInt(req.query.limit || 200, 1, 1000);
    const rows = db.listSince(sinceIso, limit);
    return ok(res, rows, { since: sinceIso, limit, returned: rows.length });
  });

  router.get("/docs/source/:source", (req, res) => {
    const source = String(req.params.source || "").trim();
    if (!source) return badRequest(res, "missing source");

    const limit = clampInt(req.query.limit || 200, 1, 1000);
    const rows = db.listBySource(source, limit);
    return ok(res, rows, { source, limit, returned: rows.length });
  });

  router.get("/docs/search", (req, res) => {
    const q = String(req.query.q || "").trim();
    if (!q) return badRequest(res, "missing query param: q");

    const limit = clampInt(req.query.limit || 200, 1, 1000);
    const rows = db.search(q, limit);
    return ok(res, rows, { q, limit, returned: rows.length });
  });

  return router;
}

module.exports = {
  buildRouter
};
