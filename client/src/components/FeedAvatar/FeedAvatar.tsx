import { Show } from "solid-js";
import type { Feed } from "$lib/api";
import styles from "./feedAvatar.module.css";

interface FeedAvatarProps {
  feed: Pick<Feed, "title" | "image">;
  size?: number;
}

export function FeedAvatar(props: FeedAvatarProps) {
  const size = () => props.size ?? 28;
  const initials = () =>
    (props.feed.title || "??")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join("")
      .toUpperCase();

  const hue = () => titleHue(props.feed.title);

  return (
    <div
      class={styles.avatar}
      style={{
        width: `${size()}px`,
        height: `${size()}px`,
        "font-size": `${size() * 0.42}px`,
        "--avatar-hue": hue(),
      }}
    >
      <Show when={props.feed.image} fallback={<span>{initials()}</span>}>
        {url => (
          <img
            src={url()}
            alt=""
            loading="lazy"
            width={size()}
            height={size()}
          />
        )}
      </Show>
    </div>
  );
}

export function titleHue(title: string | undefined): number {
  if (!title) return 60;
  let h = 0;
  for (let i = 0; i < title.length; i++) {
    h = (h * 31 + title.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}
