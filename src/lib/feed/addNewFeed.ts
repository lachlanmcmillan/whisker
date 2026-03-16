import type { Feed } from "../../models/feed.model";
import { upsertFeed } from "../../models/feed.model";
import { parseAtomFeed } from "../atom/parse";
import { parseRssFeed } from "../rss/parse";

export async function addNewFeed(url: string): Promise<Feed> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();

  let feed: Feed;
  if (/<feed[\s>]/i.test(xml)) {
    feed = parseAtomFeed(xml);
  } else if (/<rss[\s>]/i.test(xml)) {
    feed = parseRssFeed(xml);
  } else {
    throw new Error("Unrecognized feed format: expected Atom or RSS");
  }

  if (!feed.link) {
    feed.link = url;
  }

  await upsertFeed(feed);

  return feed;
}
