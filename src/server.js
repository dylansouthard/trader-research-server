const express = require("express");
const { loadConfig } = require("./config");
const { createDb } = require("./db");
const { buildRouter } = require("./routes");
const { createLogger } = require("./logger");

function startServer(options = {}) {
  const bootLog = typeof options.bootLog === "function" ? options.bootLog : () => {};
  bootLog("server.start.begin");

  const cfg = loadConfig({ loadFeeds: false });
  bootLog("server.config.loaded");
  const logger = createLogger(cfg);
  logger.info("server_boot", { phase: "config_loaded" });
  const db = createDb(cfg.dbPath);
  logger.info("server_boot", { phase: "db_ready", db_path: cfg.dbPath });

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info("http_request", {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms: Date.now() - start
      });
    });
    next();
  });
  app.use(buildRouter(db));
  app.use((err, req, res, next) => {
    logger.error("http_uncaught_error", {
      method: req.method,
      path: req.originalUrl,
      error: err?.stack || err?.message || String(err)
    });
    res.status(500).json({ ok: false, error: "internal_error" });
  });

  const server = app.listen(cfg.port, () => {
    console.log(`[research-server] listening on :${cfg.port}`);
    console.log(`[research-server] db: ${cfg.dbPath}`);
    console.log(`[research-server] log file: ${cfg.logFile}`);
    logger.info("server_started", {
      port: cfg.port,
      db_path: cfg.dbPath
    });
    bootLog(`server.listen.ok port=${cfg.port}`);
  });
  server.on("error", (err) => {
    logger.error("server_listen_error", { error: err?.stack || err?.message || String(err) });
    bootLog(`server.listen.error error=${err?.message || String(err)}`);
  });

  function shutdown() {
    logger.info("server_shutdown_requested");
    server.close(() => {
      db.close();
      logger.info("server_stopped");
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("uncaughtException", (err) => {
    logger.error("uncaught_exception", { error: err?.stack || err?.message || String(err) });
    bootLog(`process.uncaught_exception error=${err?.message || String(err)}`);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("unhandled_rejection", { error: String(reason) });
    bootLog(`process.unhandled_rejection error=${String(reason)}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer
};
