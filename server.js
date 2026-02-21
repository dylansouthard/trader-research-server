const fs = require("fs");
const path = require("path");

const bootLogFile = process.env.BOOT_LOG_FILE || path.resolve(__dirname, "logs", "startup.log");
const fallbackBootLogFile = "/tmp/research-server-startup.log";

function bootLog(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  // Always emit to stderr so hosting panels that capture stderr show diagnostics.
  try {
    process.stderr.write(line);
  } catch {
    // ignore
  }

  // Try configured/local startup log path.
  try {
    fs.mkdirSync(path.dirname(bootLogFile), { recursive: true });
    fs.appendFileSync(bootLogFile, line, "utf-8");
  } catch {
    // ignore; we'll try /tmp fallback.
  }

  // Fallback log path for restrictive shared-host directory layouts.
  try {
    fs.appendFileSync(fallbackBootLogFile, line, "utf-8");
  } catch {
    // Avoid crashing logger on boot path issues.
  }
}

bootLog("bootstrap.entry server.js");
bootLog(`bootstrap.env cwd=${process.cwd()} dirname=${__dirname} node=${process.version} pid=${process.pid}`);
bootLog(`bootstrap.env PORT=${process.env.PORT || ""} NODE_ENV=${process.env.NODE_ENV || ""}`);

try {
  const { startServer } = require("./src/server");
  bootLog("bootstrap.require_ok src/server");
  startServer({ bootLog });
} catch (err) {
  bootLog(`bootstrap.fatal error=${err?.stack || err?.message || String(err)}`);
  throw err;
}
