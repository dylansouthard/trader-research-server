const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sha256(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex");
}

function toIsoUtc(input) {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function appendLogLine(logFile, line) {
  ensureDir(path.dirname(logFile));
  fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`, "utf-8");
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function runWorker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) break;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = [];
  const n = Math.max(1, Math.min(limit, items.length || 1));
  for (let i = 0; i < n; i += 1) {
    workers.push(runWorker());
  }
  await Promise.all(workers);
  return results;
}

module.exports = {
  ensureDir,
  sha256,
  toIsoUtc,
  sleep,
  clampInt,
  appendLogLine,
  mapWithConcurrency
};
