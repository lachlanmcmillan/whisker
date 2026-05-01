import { Show } from "solid-js";
import type { Feed, FeedEntry } from "$lib/api";
import { FeedAvatar, titleHue } from "$components/FeedAvatar/FeedAvatar";
import { CachedThumbnail } from "$components/CachedThumbnail/CachedThumbnail";
import { Icon, entryTypeFromUrl } from "$components/Icon/Icon";
import { timeAgo } from "$lib/timeAgo";
import { toggleEntryRead } from "$stores/feeds.store";
import styles from "./entryCard.module.css";

interface EntryCardProps {
  entry: FeedEntry;
  feed: Pick<Feed, "id" | "title" | "image">;
}

export function EntryCard(props: EntryCardProps) {
  const isRead = () => !!props.entry.openedAt;
  const handleOpen = () => {
    if (!props.entry.feedId) return;
    toggleEntryRead(props.entry.feedId, props.entry.entryId, false);
  };
  const thumb = () => props.entry.thumbnail ?? props.feed.image ?? null;

  return (
    <article class={styles.card} data-read={isRead() ? "true" : "false"}>
      <a
        class={styles.thumbLink}
        href={props.entry.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleOpen}
      >
        <Show
          when={thumb()}
          fallback={
            <div
              class={styles.thumbPlaceholder}
              style={{ "--thumb-hue": titleHue(props.feed.title) }}
            />
          }
        >
          {url => (
            <CachedThumbnail
              url={url()}
              alt={props.entry.title}
              class={styles.thumb}
            />
          )}
        </Show>
      </a>
      <div class={styles.body}>
        <FeedAvatar feed={props.feed} size={30} />
        <div class={styles.text}>
          <h3 class={styles.title}>
            <a
              href={props.entry.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOpen}
            >
              {props.entry.title}
            </a>
          </h3>
          <div class={styles.meta}>
            <Icon
              name={entryTypeFromUrl(props.entry.link)}
              size={12}
              color="var(--accent)"
            />
            <span>
              {props.feed.title} · {timeAgo(props.entry.published)}
            </span>
          </div>
          <Show when={props.entry.description}>
            <p class={styles.blurb}>{props.entry.description}</p>
          </Show>
        </div>
      </div>
    </article>
  );
}
