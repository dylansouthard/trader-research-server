const { sha256, toIsoUtc } = require("./util");

function firstNonEmpty(...values) {
  for (const v of values) {
    const s = String(v || "").trim();
    if (s) return s;
  }
  return "";
}

function normalizeFeedItem(feed, item, fetchedUtc) {
  const title = firstNonEmpty(item?.title);
  if (!title) return null;

  const url = firstNonEmpty(item?.link, item?.url, item?.guid) || null;
  const publishedFromFeed = toIsoUtc(item?.isoDate || item?.pubDate || item?.published || item?.updated);
  const missingPublished = !publishedFromFeed;
  const publishedUtc = publishedFromFeed || fetchedUtc;

  const summary = firstNonEmpty(
    item?.contentSnippet,
    item?.summary,
    item?.content,
    item?.description
  ) || null;

  const idSeed = url || `${feed.name}|${title}|${publishedUtc}`;
  const id = sha256(idSeed);

  return {
    id,
    source: feed.name,
    feed_type: feed.type,
    title,
    url,
    published_utc: publishedUtc,
    summary,
    content: null,
    fetched_utc: fetchedUtc,
    raw_json: JSON.stringify({
      missing_published: missingPublished,
      item
    })
  };
}

module.exports = {
  normalizeFeedItem
};
