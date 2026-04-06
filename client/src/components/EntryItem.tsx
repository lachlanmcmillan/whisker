import { createSignal, Show } from "solid-js";
import DOMPurify from "dompurify";
import type { FeedEntry } from "../lib/api";
import { Button } from "./Button";
import { CachedThumbnail } from "./CachedThumbnail";
import { CheckButton } from "./CheckButton";
import { Link } from "./Link";
import { Title } from "./Title";
import { toggleEntryRead } from "../stores/feeds.store";
import styles from "./entryItem.module.css";

export function EntryItem(props: { entry: FeedEntry }) {
  const [expanded, setExpanded] = createSignal(false);

  const handleOpen = () => {
    if (props.entry.feedId) {
      toggleEntryRead(props.entry.feedId, props.entry.entryId, false);
    }
  };

  return (
    <li class={styles.entry}>
      <CheckButton
        checked={!!props.entry.openedAt}
        onClick={() => {
          if (!props.entry.feedId) return;
          toggleEntryRead(props.entry.feedId, props.entry.entryId, !!props.entry.openedAt);
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
          by {props.entry.author} —{" "}
          {new Date(props.entry.published).toLocaleDateString()}
          <Show when={props.entry.updated}>
            {` — Updated: ${new Date(props.entry.updated!).toLocaleDateString()}`}
          </Show>
        </p>
        <Show when={props.entry.description}>
          <p class={styles.description}>{props.entry.description}</p>
        </Show>
        <Show when={props.entry.content}>
          <Button
            variant="ghost"
            onClick={() => setExpanded(!expanded())}
          >
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
