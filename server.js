const fs = require("fs");
const path = require("path");

const bootLogFile = process.env.BOOT_LOG_FILE || path.resolve(__dirname, "logs", "startup.log");

function bootLog(message) {
  try {
    fs.mkdirSync(path.dirname(bootLogFile), { recursive: true });
    fs.appendFileSync(bootLogFile, `${new Date().toISOString()} ${message}\n`, "utf-8");
  } catch {
    // Avoid crashing logger on boot path issues.
  }
}

bootLog("bootstrap.entry server.js");

try {
  const { startServer } = require("./src/server");
  bootLog("bootstrap.require_ok src/server");
  startServer({ bootLog });
} catch (err) {
  bootLog(`bootstrap.fatal error=${err?.stack || err?.message || String(err)}`);
  throw err;
}
