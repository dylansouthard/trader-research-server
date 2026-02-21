const path = require("path");
const sqlite3 = require("sqlite3");
const { ensureDir } = require("./util");

function openDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function closeDb(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function createDb(dbPath) {
  ensureDir(path.dirname(dbPath));
  const db = await openDatabase(dbPath);

  await run(db, "PRAGMA journal_mode = WAL");
  await run(db, "PRAGMA synchronous = NORMAL");

  await exec(
    db,
    `
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
  `
  );

  async function insertDoc(doc) {
    const result = await run(
      db,
      `
      INSERT OR IGNORE INTO docs (
        id, source, feed_type, title, url, published_utc, summary, content, fetched_utc, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        doc.id,
        doc.source,
        doc.feed_type,
        doc.title,
        doc.url,
        doc.published_utc,
        doc.summary,
        doc.content,
        doc.fetched_utc,
        doc.raw_json
      ]
    );
    return Number(result?.changes || 0) > 0;
  }

  async function listLatest(limit) {
    return all(
      db,
      `
      SELECT id, source, feed_type, title, url, published_utc, summary, content, fetched_utc
      FROM docs
      ORDER BY published_utc DESC
      LIMIT ?
      `,
      [limit]
    );
  }

  async function listSince(sinceIso, limit) {
    return all(
      db,
      `
      SELECT id, source, feed_type, title, url, published_utc, summary, content, fetched_utc
      FROM docs
      WHERE published_utc > ?
      ORDER BY published_utc DESC
      LIMIT ?
      `,
      [sinceIso, limit]
    );
  }

  async function listBySource(source, limit) {
    return all(
      db,
      `
      SELECT id, source, feed_type, title, url, published_utc, summary, content, fetched_utc
      FROM docs
      WHERE source = ?
      ORDER BY published_utc DESC
      LIMIT ?
      `,
      [source, limit]
    );
  }

  async function search(query, limit) {
    const q = `%${query}%`;
    return all(
      db,
      `
      SELECT id, source, feed_type, title, url, published_utc, summary, content, fetched_utc
      FROM docs
      WHERE title LIKE ? OR summary LIKE ?
      ORDER BY published_utc DESC
      LIMIT ?
      `,
      [q, q, limit]
    );
  }

  return {
    raw: db,
    close: () => closeDb(db),
    insertDoc,
    listLatest,
    listSince,
    listBySource,
    search
  };
}

module.exports = {
  createDb
};
