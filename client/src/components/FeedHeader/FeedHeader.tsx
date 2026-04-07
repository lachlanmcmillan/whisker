import { Show } from "solid-js";
import { Title } from "$components/Title/Title";
import type { Feed } from "$lib/api";
import { timeAgo } from "$lib/timeAgo";
import styles from "./FeedHeader.module.css";

interface FeedHeaderProps {
  feed: Feed;
}

export function FeedHeader(props: FeedHeaderProps) {
  return (
    <div class={styles.feedHeader}>
      <Title>{props.feed.title}</Title>
      <p class={styles.meta}>
        {props.feed.author && <>by {props.feed.author}</>}
        {props.feed.author && props.feed.fetchedAt && <> — </>}
        {props.feed.fetchedAt && <>Fetched {timeAgo(props.feed.fetchedAt)}</>}
      </p>
      <Show when={props.feed.description}>
        <p>{props.feed.description}</p>
      </Show>
    </div>
  );
}
