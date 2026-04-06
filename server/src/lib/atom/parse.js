import { XMLParser } from "fast-xml-parser";
import { ok, err } from "@whisker/common";
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
});
export function parseAtomFeed(xml) {
    let doc;
    try {
        doc = parser.parse(xml);
    }
    catch (e) {
        return err("parse_failed", "Failed to parse Atom XML", {
            cause: e instanceof Error ? e.message : String(e),
            xmlSnippet: xml.slice(0, 500),
        });
    }
    const feed = doc.feed;
    const links = Array.isArray(feed.link) ? feed.link : [feed.link];
    const altLink = links.find((l) => l["@_rel"] === "alternate")?.["@_href"] ?? "";
    const rawEntries = Array.isArray(feed.entry)
        ? feed.entry
        : feed.entry
            ? [feed.entry]
            : [];
    return ok({
        title: feed.title,
        description: "",
        link: altLink,
        feedUrl: "",
        author: feed.author?.name ?? "",
        published: toISODate(feed.published ?? ""),
        entries: rawEntries.map(parseEntry),
    });
}
function toISODate(dateStr) {
    if (!dateStr)
        return "";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toISOString();
}
function parseEntry(raw) {
    const link = Array.isArray(raw.link)
        ? (raw.link.find((l) => l["@_rel"] === "alternate")?.["@_href"] ?? "")
        : (raw.link?.["@_href"] ?? "");
    const media = raw["media:group"];
    const thumbnail = media?.["media:thumbnail"];
    return {
        entryId: raw.id,
        title: raw.title,
        link,
        author: raw.author?.name ?? "",
        published: toISODate(raw.published ?? ""),
        updated: raw.updated ? toISODate(raw.updated) : undefined,
        description: media?.["media:description"] ?? "",
        thumbnail: thumbnail?.["@_url"],
    };
}
