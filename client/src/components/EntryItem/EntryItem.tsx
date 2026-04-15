import { createSignal, Show } from "solid-js";
import DOMPurify from "dompurify";
import type { FeedEntry } from "$lib/api";
import { Button } from "$components/Button/Button";
import { CachedThumbnail } from "$components/CachedThumbnail/CachedThumbnail";
import { CheckButton } from "$components/CheckButton/CheckButton";
import { Link } from "$components/Link/Link";
import { Title } from "$components/Title/Title";
import { ArchiveButton } from "$components/ArchiveButton/ArchiveButton";
import { StarButton } from "$components/StarButton/StarButton";
import { timeAgo } from "$lib/timeAgo";
import { toggleEntryRead, toggleEntryArchived, toggleEntryStarred } from "$stores/feeds.store";
import styles from "./entryItem.module.css";

export function EntryItem(props: { entry: FeedEntry }) {
  const [expanded, setExpanded] = createSignal(false);

  const handleOpen = () => {
    if (props.entry.feedId) {
      toggleEntryRead(props.entry.feedId, props.entry.entryId, false);
    }
  };

  return (
    <li class={styles.entry} data-opened-at={props.entry.openedAt}>
      <CheckButton
        checked={!!props.entry.openedAt}
        onClick={() => {
          if (!props.entry.feedId) return;
          toggleEntryRead(
            props.entry.feedId,
            props.entry.entryId,
            !!props.entry.openedAt
          );
        }}
      />
      <ArchiveButton
        archived={!!props.entry.archivedAt}
        onClick={() => {
          if (!props.entry.feedId) return;
          toggleEntryArchived(
            props.entry.feedId,
            props.entry.entryId,
            !!props.entry.archivedAt
          );
        }}
      />
      <StarButton
        starred={!!props.entry.starredAt}
        onClick={() => {
          if (!props.entry.feedId) return;
          toggleEntryStarred(
            props.entry.feedId,
            props.entry.entryId,
            !!props.entry.starredAt
          );
        }}
      />
      <Show when={props.entry.thumbnail}>
        <Link href={props.entry.link} onClick={handleOpen}>
          <CachedThumbnail
            url={props.entry.thumbnail!}
            width={120}
            alt={props.entry.title}
          />
        </Link>
      </Show>
      <div class={styles.entryBody}>
        <Title level={2}>
          <Link href={props.entry.link} onClick={handleOpen}>
            {props.entry.title}
          </Link>
        </Title>
        <p class={styles.meta}>
          by {props.entry.author} — {timeAgo(props.entry.published)}
          <Show when={props.entry.updated}>
            {` — Updated ${timeAgo(props.entry.updated!)}`}
          </Show>
        </p>
        <Show when={props.entry.description}>
          <p class={styles.description}>{props.entry.description}</p>
        </Show>
        <Show when={props.entry.content}>
          <Button variant="ghost" onClick={() => setExpanded(!expanded())}>
            {expanded() ? "show less" : "show more..."}
          </Button>
          <Show when={expanded()}>
            <div
              class={styles.content}
              innerHTML={DOMPurify.sanitize(props.entry.content!)}
            />
          </Show>
        </Show>
      </div>
    </li>
  );
}
