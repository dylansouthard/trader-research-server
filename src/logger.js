const { appendLogLine } = require("./util");

function createLogger(cfg) {
  const levels = { debug: 10, info: 20, warn: 30, error: 40 };
  const current = levels[cfg.logLevel] || levels.info;

  function shouldLog(level) {
    return (levels[level] || levels.info) >= current;
  }

  function log(level, message, fields = {}) {
    if (!shouldLog(level)) return;

    const parts = [`[${level}]`, message];
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null) continue;
      const text = typeof v === "string" ? JSON.stringify(v) : String(v);
      parts.push(`${k}=${text}`);
    }
    appendLogLine(cfg.logFile, parts.join(" "));
  }

  return {
    debug: (message, fields) => log("debug", message, fields),
    info: (message, fields) => log("info", message, fields),
    warn: (message, fields) => log("warn", message, fields),
    error: (message, fields) => log("error", message, fields)
  };
}

module.exports = {
  createLogger
};
