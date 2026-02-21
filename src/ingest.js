const Parser = require("rss-parser");
const { loadConfig } = require("./config");
const { createDb } = require("./db");
const { normalizeFeedItem } = require("./normalize");
const { createLogger } = require("./logger");
const { sleep, mapWithConcurrency } = require("./util");

const parser = new Parser();

async function fetchFeedXml(url, userAgent, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": userAgent,
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
      },
      signal: ctrl.signal
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFeedWithRetry(feed, cfg, attempts = 2) {
  let lastErr = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const xml = await fetchFeedXml(feed.url, cfg.userAgent, cfg.requestTimeoutMs);
      return await parser.parseString(xml);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await sleep(500 * (i + 1));
      }
    }
  }
  throw lastErr;
}

function newestFirst(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a?.isoDate || a?.pubDate || a?.published || a?.updated || 0).getTime();
    const tb = new Date(b?.isoDate || b?.pubDate || b?.published || b?.updated || 0).getTime();
    return tb - ta;
  });
}

async function runIngest() {
  const cfg = loadConfig({ requireUserAgent: true, loadFeeds: true });
  const logger = createLogger(cfg);
  const db = await createDb(cfg.dbPath);

  const summary = {
    started_utc: new Date().toISOString(),
    feeds_total: cfg.feeds.length,
    feeds_ok: 0,
    feeds_failed: 0,
    items_seen: 0,
    items_inserted: 0,
    items_skipped: 0,
    per_feed: []
  };

  logger.info("ingest_start", { feeds: cfg.feeds.length, db_path: cfg.dbPath });

  try {
    const perFeedResults = await mapWithConcurrency(cfg.feeds, cfg.maxConcurrency, async (feed) => {
      const fetchedUtc = new Date().toISOString();
      const feedStat = {
        name: feed.name,
        ok: false,
        error: null,
        seen: 0,
        inserted: 0
      };

      try {
        const parsed = await fetchFeedWithRetry(feed, cfg, 2);
        const items = Array.isArray(parsed?.items) ? newestFirst(parsed.items).slice(0, cfg.maxItemsPerFeed) : [];
        feedStat.seen = items.length;

        for (const item of items) {
          const doc = normalizeFeedItem(feed, item, fetchedUtc);
          if (!doc) {
            summary.items_skipped += 1;
            continue;
          }
          const inserted = await db.insertDoc(doc);
          if (inserted) {
            feedStat.inserted += 1;
            summary.items_inserted += 1;
          } else {
            summary.items_skipped += 1;
          }
        }

        feedStat.ok = true;
        logger.info("feed_ingest_ok", {
          feed: feed.name,
          seen: feedStat.seen,
          inserted: feedStat.inserted
        });
      } catch (err) {
        feedStat.error = `${err.name || "Error"}: ${err.message || String(err)}`;
        logger.error("feed_ingest_error", {
          feed: feed.name,
          error: feedStat.error
        });
      }

      return feedStat;
    });

    for (const f of perFeedResults) {
      summary.per_feed.push(f);
      summary.items_seen += f.seen;
      if (f.ok) summary.feeds_ok += 1;
      else summary.feeds_failed += 1;
    }
  } finally {
    await db.close();
  }

  summary.finished_utc = new Date().toISOString();
  summary.duration_ms = new Date(summary.finished_utc).getTime() - new Date(summary.started_utc).getTime();

  logger.info("ingest_done", {
    feeds_ok: summary.feeds_ok,
    feeds_failed: summary.feeds_failed,
    seen: summary.items_seen,
    inserted: summary.items_inserted,
    skipped: summary.items_skipped,
    duration_ms: summary.duration_ms
  });

  return summary;
}

module.exports = {
  runIngest
};
