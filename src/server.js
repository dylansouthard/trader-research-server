const express = require("express");
const { loadConfig } = require("./config");
const { createDb } = require("./db");
const { buildRouter } = require("./routes");
const { createLogger } = require("./logger");

function startServer() {
  const cfg = loadConfig();
  const logger = createLogger(cfg);
  const db = createDb(cfg.dbPath);

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

  const server = app.listen(cfg.port, () => {
    console.log(`[research-server] listening on :${cfg.port}`);
    console.log(`[research-server] db: ${cfg.dbPath}`);
    console.log(`[research-server] log file: ${cfg.logFile}`);
    logger.info("server_started", {
      port: cfg.port,
      db_path: cfg.dbPath
    });
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
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer
};
