import { XMLParser } from "fast-xml-parser";
import { ok, err } from "@whisker/common";
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
});
export function parseRssFeed(xml) {
    let doc;
    try {
        doc = parser.parse(xml);
    }
    catch (e) {
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
        feedUrl: "",
        author: channel["itunes:author"] ?? channel["dc:creator"] ?? "",
        published: toISODate(channel.lastBuildDate ?? channel.pubDate ?? ""),
        image: channel.image?.url,
        entries: rawItems.map(parseItem),
    });
}
function toISODate(dateStr) {
    if (!dateStr)
        return "";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toISOString();
}
function parseItem(raw) {
    return {
        entryId: raw.guid?.["#text"] ?? raw.guid ?? raw.link ?? "",
        title: raw.title ?? "",
        link: raw.link ?? "",
        author: raw["dc:creator"] ?? raw.author ?? "",
        published: toISODate(raw.pubDate ?? ""),
        description: raw.description ?? "",
        thumbnail: raw.enclosure?.["@_url"],
        content: raw["content:encoded"],
    };
}
