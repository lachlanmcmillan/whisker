import type { Feed } from "../../models/feed.model";
import { upsertFeed, readFeedByLink } from "../../models/feed.model";
import { parseAtomFeed } from "../atom/parse";
import { parseRssFeed } from "../rss/parse";
import { ok, err, type Result, type AsyncResult } from "../result";

async function fetchText(url: string): AsyncResult<string> {
  const proxiedUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;

  let response: Response;
  try {
    response = await fetch(proxiedUrl);
  } catch (e) {
    return err("fetch_failed", `Network error fetching ${url}`, {
      url,
      proxiedUrl,
      cause: e instanceof Error ? e.message : String(e),
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => null);
    return err(
      "fetch_failed",
      `HTTP ${response.status} ${response.statusText} for ${url}`,
      {
        url,
        proxiedUrl,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      }
    );
  }

  return ok(await response.text());
}

function discoverFeedUrl(html: string, baseUrl: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const link = doc.querySelector(
    'link[type="application/rss+xml"], link[type="application/atom+xml"]'
  );
  if (!link) return null;
  const href = link.getAttribute("href");
  if (!href) return null;
  return new URL(href, baseUrl).href;
}

function parseFeed(xml: string): Result<Feed> {
  if (/<feed[\s>]/i.test(xml)) {
    return parseAtomFeed(xml);
  } else if (/<rss[\s>]/i.test(xml)) {
    return parseRssFeed(xml);
  }
  return err(
    "feed_not_found",
    "Unrecognized feed format: expected Atom or RSS",
    {
      xmlSnippet: xml.slice(0, 500),
    }
  );
}

export async function addNewFeed(url: string): AsyncResult<Feed> {
  console.log("[addNewFeed] fetching", url);
  const textResult = await fetchText(url);
  if (textResult.error) return textResult;
  console.log("[addNewFeed] received %d bytes", textResult.data.length);

  let feed: Feed;
  const parseResult = parseFeed(textResult.data);
  if (parseResult.error) {
    console.log("[addNewFeed] not a feed, discovering feed link in HTML...");
    const feedUrl = discoverFeedUrl(textResult.data, url);
    if (!feedUrl) {
      return err("feed_not_found", "No RSS or Atom feed link found in HTML", {
        url,
        htmlSnippet: textResult.data.slice(0, 500),
      });
    }
    console.log("[addNewFeed] discovered feed URL:", feedUrl);

    const feedTextResult = await fetchText(feedUrl);
    if (feedTextResult.error) return feedTextResult;
    console.log(
      "[addNewFeed] fetched feed, %d bytes",
      feedTextResult.data.length
    );

    const discoveredParseResult = parseFeed(feedTextResult.data);
    if (discoveredParseResult.error) return discoveredParseResult;

    feed = discoveredParseResult.data;
    feed.feedUrl = feedUrl;
    console.log("[addNewFeed] parsed discovered feed:", feed.title);
  } else {
    feed = parseResult.data;
    console.log("[addNewFeed] parsed as direct feed:", feed.title);
  }

  if (!feed.link) {
    feed.link = url;
  }
  if (!feed.feedUrl) {
    feed.feedUrl = url;
  }

  const existingResult = await readFeedByLink(feed.link);
  if (existingResult.error) return existingResult;
  if (existingResult.data) {
    console.log("[addNewFeed] feed already exists:", existingResult.data.title);
    return err(
      "feed_already_exists",
      `This feed "${existingResult.data.title}" already exists`,
      { url, feedLink: feed.link, existingTitle: existingResult.data.title }
    );
  }

  feed.fetchedAt = new Date().toISOString();

  console.log(
    "[addNewFeed] upserting feed '%s' with %d entries",
    feed.title,
    feed.entries.length
  );
  const upsertResult = await upsertFeed(feed);
  if (upsertResult.error) return upsertResult;

  return ok(feed);
}

export async function refreshFeed(url: string): AsyncResult<Feed> {
  console.log("[refreshFeed] fetching", url);
  const textResult = await fetchText(url);
  if (textResult.error) return textResult;

  let feed: Feed;
  const parseResult = parseFeed(textResult.data);
  if (parseResult.error) {
    console.log("[refreshFeed] not a feed, discovering feed link in HTML...");
    const discoveredUrl = discoverFeedUrl(textResult.data, url);
    if (!discoveredUrl) {
      return err("feed_not_found", "No RSS or Atom feed link found", { url });
    }
    console.log("[refreshFeed] discovered feed URL:", discoveredUrl);

    const feedTextResult = await fetchText(discoveredUrl);
    if (feedTextResult.error) return feedTextResult;

    const discoveredParseResult = parseFeed(feedTextResult.data);
    if (discoveredParseResult.error) return discoveredParseResult;

    feed = discoveredParseResult.data;
    feed.feedUrl = discoveredUrl;
  } else {
    feed = parseResult.data;
    feed.feedUrl = url;
  }

  feed.fetchedAt = new Date().toISOString();

  if (!feed.link) {
    feed.link = url;
  }

  console.log(
    "[refreshFeed] upserting feed '%s' with %d entries",
    feed.title,
    feed.entries.length
  );
  const upsertResult = await upsertFeed(feed);
  if (upsertResult.error) return upsertResult;

  return ok(feed);
}
