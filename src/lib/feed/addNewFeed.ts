import type { Feed } from "../../models/feed.model";
import { upsertFeed } from "../../models/feed.model";
import { parseAtomFeed } from "../atom/parse";
import { parseRssFeed } from "../rss/parse";

async function fetchText(url: string): Promise<string> {
  const proxiedUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxiedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  return response.text();
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

function parseFeed(xml: string): Feed {
  if (/<feed[\s>]/i.test(xml)) {
    return parseAtomFeed(xml);
  } else if (/<rss[\s>]/i.test(xml)) {
    return parseRssFeed(xml);
  }
  throw new Error("Unrecognized feed format: expected Atom or RSS");
}

export async function addNewFeed(url: string): Promise<Feed> {
  console.log("[addNewFeed] fetching", url);
  const text = await fetchText(url);
  console.log("[addNewFeed] received %d bytes", text.length);

  let feed: Feed;
  try {
    feed = parseFeed(text);
    console.log("[addNewFeed] parsed as direct feed:", feed.title);
  } catch {
    console.log("[addNewFeed] not a feed, discovering feed link in HTML...");
    const feedUrl = discoverFeedUrl(text, url);
    if (!feedUrl) {
      throw new Error("No RSS or Atom feed found at this URL");
    }
    console.log("[addNewFeed] discovered feed URL:", feedUrl);
    const feedText = await fetchText(feedUrl);
    console.log("[addNewFeed] fetched feed, %d bytes", feedText.length);
    feed = parseFeed(feedText);
    console.log("[addNewFeed] parsed discovered feed:", feed.title);
  }

  if (!feed.link) {
    feed.link = url;
  }

  console.log("[addNewFeed] upserting feed '%s' with %d entries", feed.title, feed.entries.length);
  await upsertFeed(feed);

  return feed;
}
