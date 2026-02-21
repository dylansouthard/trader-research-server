#!/usr/bin/env node
const { loadConfig } = require("../src/config");
const { createDb } = require("../src/db");

(async () => {
  try {
    const cfg = loadConfig();
    const db = await createDb(cfg.dbPath);
    await db.close();
    console.log(JSON.stringify({ ok: true, migrated: true, db_path: cfg.dbPath }, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: `${err.name || "Error"}: ${err.message || String(err)}`
        },
        null,
        2
      )
    );
    process.exit(1);
  }
})();
