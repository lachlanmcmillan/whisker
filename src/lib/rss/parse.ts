import { XMLParser } from "fast-xml-parser";
import type { Feed, FeedEntry } from "../../models/feed.model";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export function parseRssFeed(xml: string): Feed {
  const doc = parser.parse(xml);
  const channel = doc.rss.channel;

  const rawItems = Array.isArray(channel.item)
    ? channel.item
    : channel.item
      ? [channel.item]
      : [];

  return {
    title: channel.title,
    description: channel.description ?? "",
    link: channel.link ?? "",
    author: channel["itunes:author"] ?? channel["dc:creator"] ?? "",
    published: channel.lastBuildDate ?? channel.pubDate ?? "",
    image: channel.image?.url,
    entries: rawItems.map(parseItem),
  };
}

function parseItem(raw: any): FeedEntry {
  const enclosure = raw.enclosure;

  return {
    id: raw.guid?.["#text"] ?? raw.guid ?? raw.link ?? "",
    title: raw.title ?? "",
    link: raw.link ?? "",
    author: raw["dc:creator"] ?? raw.author ?? "",
    published: raw.pubDate ?? "",
    description: raw.description ?? "",
    thumbnail: enclosure?.["@_url"],
    content: raw["content:encoded"],
  };
}
