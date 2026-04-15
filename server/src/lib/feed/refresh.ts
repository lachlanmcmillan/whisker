import { err, ok, type Result } from "@whisker/common";
import { fetchFeed } from "./fetch";
import { logger } from "../logger";
import { feeds } from "../../models/feeds.model";

const BACKGROUND_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let isBackgroundRefreshRunning = false;
let backgroundRefreshIntervalId: ReturnType<typeof setInterval> | null = null;

export async function refreshStoredFeed(feedId: number): Promise<Result<void>> {
  const feedResult = feeds.readById(feedId);
  if (feedResult.error) return feedResult;
  if (!feedResult.data) {
    return err("feed_not_found", "Feed not found", { feedId });
  }

  const feedUrl = feedResult.data.feedUrl || feedResult.data.link;
  const fetchResult = await fetchFeed(feedUrl);
  if (fetchResult.error) return fetchResult;

  const upsertResult = feeds.upsert(fetchResult.data);
  if (upsertResult.error) return upsertResult;

  return ok(undefined);
}

function isFeedDue(
  refreshIntervalMins: number | null,
  fetchedAt: string | null
): boolean {
  if (refreshIntervalMins === null) return false;
  if (!fetchedAt) return true;

  const fetchedAtMs = Date.parse(fetchedAt);
  if (Number.isNaN(fetchedAtMs)) return true;

  return Date.now() - fetchedAtMs >= refreshIntervalMins * 60_000;
}

export async function backgroundRefreshFeeds(): Promise<void> {
  if (isBackgroundRefreshRunning) return;

  isBackgroundRefreshRunning = true;

  try {
    const feedRowsResult = feeds.readAllRows();
    if (feedRowsResult.error) {
      logger.err({
        event: "background_refresh_failed_to_load_feeds",
        error: feedRowsResult.error,
      });
      return;
    }

    for (const feed of feedRowsResult.data) {
      if (!isFeedDue(feed.refreshIntervalMins, feed.fetchedAt)) continue;

      const refreshResult = await refreshStoredFeed(feed.id);
      if (refreshResult.error) {
        logger.err({
          event: "background_refresh_failed",
          feedId: feed.id,
          error: refreshResult.error,
        });
      }
    }
  } finally {
    isBackgroundRefreshRunning = false;
  }
}

export function startBackgroundRefreshScheduler(): void {
  if (backgroundRefreshIntervalId !== null) return;

  logger.info({
    event: "background_refresh_scheduler_started",
    intervalMs: BACKGROUND_REFRESH_INTERVAL_MS,
  });
  void backgroundRefreshFeeds();
  backgroundRefreshIntervalId = setInterval(() => {
    void backgroundRefreshFeeds();
  }, BACKGROUND_REFRESH_INTERVAL_MS);
}
