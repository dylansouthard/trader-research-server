#!/usr/bin/env node
const { runIngest } = require("../src/ingest");

(async () => {
  try {
    const summary = await runIngest();
    console.log(JSON.stringify(summary, null, 2));
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
