const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { clampInt } = require("./util");

const ALLOWED_FEED_TYPES = new Set(["news", "macro", "filing", "energy", "global"]);
const PROJECT_ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  dotenv.config({ path: path.resolve(PROJECT_ROOT, ".env"), override: false });
}

function loadFileConfig(configPath) {
  const fullPath = path.resolve(PROJECT_ROOT, configPath);
  if (!fs.existsSync(fullPath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    throw new Error(`failed to parse config file ${fullPath}: ${e.message || String(e)}`);
  }
}

function loadFeedsFile(feedsPath) {
  const fullPath = path.resolve(PROJECT_ROOT, feedsPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`feeds file not found: ${fullPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  if (!Array.isArray(raw)) {
    throw new Error("feeds.json must be an array");
  }

  return raw.map((feed, i) => {
    const name = String(feed?.name || "").trim();
    const url = String(feed?.url || "").trim();
    const type = String(feed?.type || "").trim();
    if (!name || !url || !type) {
      throw new Error(`invalid feed at index ${i}: name/url/type required`);
    }
    if (!ALLOWED_FEED_TYPES.has(type)) {
      throw new Error(`invalid feed type at index ${i}: ${type}`);
    }
    return { name, url, type };
  });
}

function resolvePath(p) {
  if (!p) return p;
  return path.isAbsolute(p) ? p : path.resolve(PROJECT_ROOT, p);
}

function loadConfig(options = {}) {
  const requireUserAgent = Boolean(options.requireUserAgent);
  const loadFeeds = options.loadFeeds !== false;

  loadEnv();
  const fileCfg = loadFileConfig("./config.json");
  const filePort = fileCfg.port ?? fileCfg.PORT;
  const fileDbPath = fileCfg.db_path ?? fileCfg.DB_PATH;
  const fileFeedsPath = fileCfg.feeds_path ?? fileCfg.FEEDS_PATH;
  const fileUserAgent = fileCfg.user_agent ?? fileCfg.USER_AGENT;
  const fileRequestTimeout = fileCfg.request_timeout_ms ?? fileCfg.REQUEST_TIMEOUT_MS;
  const fileMaxItems = fileCfg.max_items_per_feed ?? fileCfg.MAX_ITEMS_PER_FEED;
  const fileMaxConcurrency = fileCfg.max_concurrency ?? fileCfg.MAX_CONCURRENCY;
  const fileLogLevel = fileCfg.log_level ?? fileCfg.LOG_LEVEL;
  const fileLogFile = fileCfg.log_file ?? fileCfg.LOG_FILE ?? fileCfg.ingest_log_path ?? fileCfg.INGEST_LOG_PATH;

  const cfg = {
    port: clampInt(process.env.PORT || filePort || 8787, 1, 65535),
    dbPath: resolvePath(process.env.DB_PATH || fileDbPath || "./storage/research.sqlite"),
    feedsPath: process.env.FEEDS_PATH || fileFeedsPath || "./feeds.json",
    userAgent: String(process.env.USER_AGENT || fileUserAgent || "ResearchServer/0.1 (contact: you@example.com)").trim(),
    requestTimeoutMs: clampInt(process.env.REQUEST_TIMEOUT_MS || fileRequestTimeout || 15000, 1000, 120000),
    maxItemsPerFeed: clampInt(process.env.MAX_ITEMS_PER_FEED || fileMaxItems || 50, 1, 500),
    maxConcurrency: clampInt(process.env.MAX_CONCURRENCY || fileMaxConcurrency || 4, 1, 32),
    logLevel: String(process.env.LOG_LEVEL || fileLogLevel || "info").trim().toLowerCase(),
    logFile: resolvePath(process.env.LOG_FILE || fileLogFile || "./logs/ingest.log")
  };

  if (requireUserAgent && (!cfg.userAgent || !cfg.userAgent.includes("contact:"))) {
    throw new Error("USER_AGENT must be descriptive and include contact info, e.g. '(contact: you@example.com)'");
  }

  cfg.feeds = loadFeeds ? loadFeedsFile(cfg.feedsPath) : [];
  return cfg;
}

module.exports = {
  loadConfig,
  ALLOWED_FEED_TYPES
};
