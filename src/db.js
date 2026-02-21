const path = require("path");
const Database = require("better-sqlite3");
const { ensureDir } = require("./util");

function createDb(dbPath) {
  ensureDir(path.dirname(dbPath));
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      feed_type TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      published_utc TEXT,
      summary TEXT,
      content TEXT,
      fetched_utc TEXT NOT NULL,
      raw_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_docs_published ON docs(published_utc DESC);
    CREATE INDEX IF NOT EXISTS idx_docs_source ON docs(source);
    CREATE INDEX IF NOT EXISTS idx_docs_url ON docs(url);
  `);

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO docs (
      id, source, feed_type, title, url, published_utc, summary, content, fetched_utc, raw_json
    ) VALUES (
      @id, @source, @feed_type, @title, @url, @published_utc, @summary, @content, @fetched_utc, @raw_json
    )
  `);

  const latestStmt = db.prepare(`
    SELECT id, source, feed_type, title, url, published_utc, summary, content, fetched_utc
    FROM docs
    ORDER BY published_utc DESC
    LIMIT ?
  `);

  const sinceStmt = db.prepare(`
    SELECT id, source, feed_type, title, url, published_utc, summary, content, fetched_utc
    FROM docs
    WHERE published_utc > ?
    ORDER BY published_utc DESC
    LIMIT ?
  `);

  const sourceStmt = db.prepare(`
    SELECT id, source, feed_type, title, url, published_utc, summary, content, fetched_utc
    FROM docs
    WHERE source = ?
    ORDER BY published_utc DESC
    LIMIT ?
  `);

  const searchStmt = db.prepare(`
    SELECT id, source, feed_type, title, url, published_utc, summary, content, fetched_utc
    FROM docs
    WHERE title LIKE ? OR summary LIKE ?
    ORDER BY published_utc DESC
    LIMIT ?
  `);

  function insertDoc(doc) {
    const info = insertStmt.run(doc);
    return info.changes > 0;
  }

  return {
    raw: db,
    close: () => db.close(),
    insertDoc,
    listLatest: (limit) => latestStmt.all(limit),
    listSince: (sinceIso, limit) => sinceStmt.all(sinceIso, limit),
    listBySource: (source, limit) => sourceStmt.all(source, limit),
    search: (query, limit) => {
      const q = `%${query}%`;
      return searchStmt.all(q, q, limit);
    }
  };
}

module.exports = {
  createDb
};
