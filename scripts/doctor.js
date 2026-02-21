#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function result(name, ok, detail) {
  return { name, ok, detail };
}

function checkWritable(filePath) {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.probe-${Date.now()}.tmp`);
    fs.writeFileSync(probe, "ok", "utf-8");
    fs.unlinkSync(probe);
    return result(`writable:${dir}`, true, "ok");
  } catch (e) {
    return result(`writable:${path.dirname(filePath)}`, false, `${e.name}: ${e.message}`);
  }
}

function safeRequire(name) {
  try {
    require(name);
    return result(`require:${name}`, true, "ok");
  } catch (e) {
    return result(`require:${name}`, false, `${e.name}: ${e.message}`);
  }
}

function main() {
  const out = {
    ok: true,
    timestamp_utc: new Date().toISOString(),
    env: {
      cwd: process.cwd(),
      node: process.version,
      pid: process.pid,
      PORT: process.env.PORT || null,
      NODE_ENV: process.env.NODE_ENV || null
    },
    checks: []
  };

  const projectRoot = path.resolve(__dirname, "..");
  const configPath = path.join(projectRoot, "config.json");
  const feedsPath = path.join(projectRoot, "feeds.json");
  const envPath = path.join(projectRoot, ".env");

  out.checks.push(result("exists:projectRoot", fs.existsSync(projectRoot), projectRoot));
  out.checks.push(result("exists:config.json", fs.existsSync(configPath), configPath));
  out.checks.push(result("exists:feeds.json", fs.existsSync(feedsPath), feedsPath));
  out.checks.push(result("exists:.env", fs.existsSync(envPath), envPath));

  out.checks.push(safeRequire("express"));
  out.checks.push(safeRequire("rss-parser"));
  out.checks.push(safeRequire("dotenv"));
  out.checks.push(safeRequire("sqlite3"));

  try {
    const { loadConfig } = require("../src/config");
    const cfg = loadConfig({ loadFeeds: false });
    out.checks.push(result("loadConfig", true, JSON.stringify({
      host: cfg.host,
      port: cfg.port,
      dbPath: cfg.dbPath,
      logFile: cfg.logFile,
      feedsPath: cfg.feedsPath,
      schedulerEnabled: cfg.schedulerEnabled,
      schedulerIntervalMinutes: cfg.schedulerIntervalMinutes,
      schedulerRunOnStart: cfg.schedulerRunOnStart
    })));

    out.checks.push(checkWritable(cfg.logFile));
    out.checks.push(checkWritable(cfg.dbPath));
  } catch (e) {
    out.checks.push(result("loadConfig", false, `${e.name}: ${e.message}`));
  }

  out.ok = out.checks.every((c) => c.ok);
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main();
