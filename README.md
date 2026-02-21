# research-server

Node.js market research ingestion server.

## What It Does

- Ingests RSS/Atom feed items into a local SQLite database.
- Deduplicates items deterministically.
- Exposes a read-only HTTP API for latest/since/source/search queries.
- Designed to run ingestion on cron (no LLM on server).

## Tech

- Node 20+
- express
- better-sqlite3
- rss-parser
- built-in fetch
- dotenv

## Project Structure

```
research-server/
  package.json
  config.json
  feeds.json
  .env.example
  storage/
    research.sqlite
  logs/
    ingest.log
  src/
    config.js
    db.js
    normalize.js
    ingest.js
    server.js
    routes.js
    util.js
  scripts/
    ingest.js
    migrate.js
  README.md
```

## Setup

```bash
cd research-server
npm install
cp .env.example .env
```

Set `USER_AGENT` in `.env` to include contact info. Example:

```env
USER_AGENT="ResearchServer/0.1 (contact: you@example.com)"
```

SEC endpoints may reject or rate-limit generic/blank user agents.

Set runtime options in `config.json` (including `log_file`).  
Environment variables override file values.

## Run Ingestion

```bash
node scripts/ingest.js
```

This prints JSON summary and appends one-line entries to `logs/ingest.log`.

## Run API Server

```bash
node src/server.js
```

Default port: `8787`.

## API

All responses are JSON:

```json
{ "ok": true, "data": [], "meta": {} }
```

Routes:

- `GET /health`
- `GET /docs/latest?limit=100`
- `GET /docs?since=2026-01-01T00:00:00Z&limit=200`
- `GET /docs/source/:source?limit=200`
- `GET /docs/search?q=inflation&limit=200`

## Cron Examples

Hourly:

```cron
0 * * * * cd /path/to/research-server && /usr/bin/node scripts/ingest.js >> /path/to/research-server/logs/cron.log 2>&1
```

Every 15 minutes:

```cron
*/15 * * * * cd /path/to/research-server && /usr/bin/node scripts/ingest.js >> /path/to/research-server/logs/cron.log 2>&1
```

## Deduping

`docs.id` logic:

- `sha256(url)` if URL exists
- else `sha256(source + "|" + title + "|" + published_utc)`

Insert mode: `INSERT OR IGNORE`.

## Notes

- v0 stores feed snippet/summary only (no full article extraction).
- Feed failures are isolated: one bad feed does not crash the run.
- Logging is append-only to a single configured file (`log_file`).
