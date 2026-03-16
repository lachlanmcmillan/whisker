import { XMLParser } from "fast-xml-parser";
import type { Feed, FeedEntry } from "../../models/feed.model";
import { ok, err, type Result } from "../result";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export function parseRssFeed(xml: string): Result<Feed> {
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    return err("parse_failed", "Failed to parse RSS XML", {
      cause: e instanceof Error ? e.message : String(e),
      xmlSnippet: xml.slice(0, 500),
    });
  }

  const channel = doc.rss.channel;

  const rawItems = Array.isArray(channel.item)
    ? channel.item
    : channel.item
      ? [channel.item]
      : [];

  return ok({
    title: channel.title,
    description: channel.description ?? "",
    link: channel.link ?? "",
    author: channel["itunes:author"] ?? channel["dc:creator"] ?? "",
    published: channel.lastBuildDate ?? channel.pubDate ?? "",
    image: channel.image?.url,
    entries: rawItems.map(parseItem),
  });
}

function parseItem(raw: any): FeedEntry {
  const enclosure = raw.enclosure;

  return {
    entryId: raw.guid?.["#text"] ?? raw.guid ?? raw.link ?? "",
    title: raw.title ?? "",
    link: raw.link ?? "",
    author: raw["dc:creator"] ?? raw.author ?? "",
    published: raw.pubDate ?? "",
    description: raw.description ?? "",
    thumbnail: enclosure?.["@_url"],
    content: raw["content:encoded"],
  };
}
