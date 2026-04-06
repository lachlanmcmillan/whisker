import { parseAtomFeed } from "../atom/parse";
import { parseRssFeed } from "../rss/parse";
import { ok, err } from "@whisker/common";
function parseFeed(xml) {
    if (/<feed[\s>]/i.test(xml))
        return parseAtomFeed(xml);
    if (/<rss[\s>]/i.test(xml))
        return parseRssFeed(xml);
    return err("feed_not_found", "Unrecognized feed format", {
        xmlSnippet: xml.slice(0, 500),
    });
}
function discoverFeedUrl(html, baseUrl) {
    const match = html.match(/<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*>/i);
    if (!match)
        return null;
    const hrefMatch = match[0].match(/href=["']([^"']+)["']/);
    if (!hrefMatch)
        return null;
    return new URL(hrefMatch[1], baseUrl).href;
}
async function fetchText(url) {
    let response;
    try {
        response = await fetch(url);
    }
    catch (e) {
        return err("fetch_failed", `Network error fetching ${url}`, {
            url,
            cause: e instanceof Error ? e.message : String(e),
        });
    }
    if (!response.ok) {
        return err("fetch_failed", `HTTP ${response.status} fetching ${url}`, {
            url,
            status: response.status,
        });
    }
    return ok(await response.text());
}
export async function fetchFeed(url) {
    const textResult = await fetchText(url);
    if (textResult.error)
        return textResult;
    let feed;
    const parseResult = parseFeed(textResult.data);
    if (parseResult.error) {
        const feedUrl = discoverFeedUrl(textResult.data, url);
        if (!feedUrl) {
            return err("feed_not_found", "No RSS or Atom feed found at this URL", {
                url,
            });
        }
        const feedTextResult = await fetchText(feedUrl);
        if (feedTextResult.error)
            return feedTextResult;
        const discoveredResult = parseFeed(feedTextResult.data);
        if (discoveredResult.error)
            return discoveredResult;
        feed = discoveredResult.data;
        feed.feedUrl = feedUrl;
    }
    else {
        feed = parseResult.data;
    }
    if (!feed.link)
        feed.link = url;
    if (!feed.feedUrl)
        feed.feedUrl = url;
    feed.fetchedAt = new Date().toISOString();
    return ok(feed);
}
