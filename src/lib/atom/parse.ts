import { XMLParser } from "fast-xml-parser";
import type { Feed, FeedEntry } from "../../models/feed.model";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export function parseAtomFeed(xml: string): Feed {
  const doc = parser.parse(xml);
  const feed = doc.feed;

  const links = Array.isArray(feed.link) ? feed.link : [feed.link];
  const altLink =
    links.find((l: any) => l["@_rel"] === "alternate")?.["@_href"] ?? "";

  const rawEntries = Array.isArray(feed.entry)
    ? feed.entry
    : feed.entry
      ? [feed.entry]
      : [];

  return {
    title: feed.title,
    description: "",
    link: altLink,
    author: feed.author?.name ?? "",
    published: feed.published ?? "",
    entries: rawEntries.map(parseEntry),
  };
}

function parseEntry(raw: any): FeedEntry {
  const link = Array.isArray(raw.link)
    ? (raw.link.find((l: any) => l["@_rel"] === "alternate")?.["@_href"] ?? "")
    : (raw.link?.["@_href"] ?? "");

  const media = raw["media:group"];
  const thumbnail = media?.["media:thumbnail"];

  return {
    entryId: raw.id,
    title: raw.title,
    link,
    author: raw.author?.name ?? "",
    published: raw.published ?? "",
    updated: raw.updated,
    description: media?.["media:description"] ?? "",
    thumbnail: thumbnail?.["@_url"],
  };
}
