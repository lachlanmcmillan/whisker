const VIDEO_ID_PREFIX = "yt:video:";
// The videos endpoint accepts at most 50 ids per request.
const BATCH_SIZE = 50;
const MAX_BATCHES_PER_RUN = 20;

interface VideoItem {
  id: string;
  snippet?: { liveBroadcastContent?: string };
  contentDetails?: { duration?: string };
}

function parseIsoDuration(value: string): number | null {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    value
  );
  if (!match) return null;
  const [, d = "0", h = "0", m = "0", s = "0"] = match;
  return ((Number(d) * 24 + Number(h)) * 60 + Number(m)) * 60 + Number(s);
}

// Looks up lengths for YouTube entries that don't have one yet. Live and
// upcoming streams are left for the next refresh, since their length isn't final.
export async function fillVideoDurations(
  db: D1Database,
  apiKey: string | undefined
): Promise<void> {
  if (!apiKey) return;
  const checked = new Set<number>();

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const { results } = await db
      .prepare(
        `SELECT id, entryId FROM entries
        WHERE durationSeconds IS NULL AND entryId LIKE ?
        AND id NOT IN (SELECT value FROM json_each(?))
        LIMIT ?`
      )
      .bind(`${VIDEO_ID_PREFIX}%`, JSON.stringify([...checked]), BATCH_SIZE)
      .all<{ id: number; entryId: string }>();
    if (results.length === 0) return;

    const videoIds = results.map(r => r.entryId.slice(VIDEO_ID_PREFIX.length));
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "contentDetails,snippet");
    url.searchParams.set("id", videoIds.join(","));
    url.searchParams.set("key", apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      console.error("youtube_duration_failed", response.status);
      return;
    }
    const { items = [] } = (await response.json()) as { items?: VideoItem[] };
    const byId = new Map(items.map(item => [item.id, item]));

    const updates = results.flatMap(({ id, entryId }) => {
      checked.add(id);
      const item = byId.get(entryId.slice(VIDEO_ID_PREFIX.length));
      const live = item?.snippet?.liveBroadcastContent;
      if (live === "live" || live === "upcoming") return [];
      // Deleted or private videos aren't returned; store 0 so they aren't retried.
      const seconds =
        item ? (parseIsoDuration(item.contentDetails?.duration ?? "") ?? 0) : 0;
      return [
        db
          .prepare("UPDATE entries SET durationSeconds = ? WHERE id = ?")
          .bind(seconds, id),
      ];
    });
    if (updates.length > 0) await db.batch(updates);
  }
}
