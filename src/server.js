const express = require("express");
const { loadConfig } = require("./config");
const { createDb } = require("./db");
const { buildRouter } = require("./routes");
const { createLogger } = require("./logger");
const { runIngest } = require("./ingest");

async function startServer(options = {}) {
  const bootLog = typeof options.bootLog === "function" ? options.bootLog : () => {};
  bootLog("server.start.begin");
  bootLog(`server.env cwd=${process.cwd()} node=${process.version} pid=${process.pid}`);

  const cfg = loadConfig({ loadFeeds: false });
  bootLog("server.config.loaded");
  bootLog(`server.config.bind host=${cfg.host} port=${cfg.port}`);
  const logger = createLogger(cfg);
  logger.info("server_boot", { phase: "config_loaded" });
  const db = await createDb(cfg.dbPath);
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

  const server = app.listen(cfg.port, cfg.host, () => {
    console.log(`[research-server] listening on ${cfg.host}:${cfg.port}`);
    console.log(`[research-server] db: ${cfg.dbPath}`);
    console.log(`[research-server] log file: ${cfg.logFile}`);
    logger.info("server_started", {
      host: cfg.host,
      port: cfg.port,
      db_path: cfg.dbPath
    });
    bootLog(`server.listen.ok host=${cfg.host} port=${cfg.port}`);
  });
  server.on("error", (err) => {
    logger.error("server_listen_error", { error: err?.stack || err?.message || String(err) });
    bootLog(`server.listen.error error=${err?.message || String(err)}`);
  });

  let schedulerTimer = null;
  let ingestInProgress = false;

  async function runScheduledIngest(trigger) {
    if (ingestInProgress) {
      logger.warn("scheduler_skip_overlap", { trigger });
      return;
    }
    ingestInProgress = true;
    try {
      logger.info("scheduler_ingest_start", { trigger });
      const summary = await runIngest();
      logger.info("scheduler_ingest_done", {
        trigger,
        feeds_ok: summary.feeds_ok,
        feeds_failed: summary.feeds_failed,
        seen: summary.items_seen,
        inserted: summary.items_inserted,
        skipped: summary.items_skipped,
        duration_ms: summary.duration_ms
      });
    } catch (err) {
      logger.error("scheduler_ingest_error", {
        trigger,
        error: err?.stack || err?.message || String(err)
      });
    } finally {
      ingestInProgress = false;
    }
  }

  if (cfg.schedulerEnabled) {
    const intervalMs = cfg.schedulerIntervalMinutes * 60 * 1000;
    logger.info("scheduler_enabled", {
      interval_minutes: cfg.schedulerIntervalMinutes,
      run_on_start: cfg.schedulerRunOnStart
    });
    if (cfg.schedulerRunOnStart) {
      setTimeout(() => {
        runScheduledIngest("startup");
      }, 1000);
    }
    schedulerTimer = setInterval(() => {
      runScheduledIngest("interval");
    }, intervalMs);
  } else {
    logger.info("scheduler_disabled");
  }

  function shutdown() {
    logger.info("server_shutdown_requested");
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
    server.close(async () => {
      await db.close();
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
  startServer().catch((err) => {
    console.error(err?.stack || err?.message || String(err));
    process.exit(1);
  });
}

module.exports = {
  startServer
};
