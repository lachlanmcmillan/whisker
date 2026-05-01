import type { JSX } from "solid-js";

type IconName =
  | "menu"
  | "close"
  | "plus"
  | "search"
  | "grid"
  | "list"
  | "bookmark"
  | "whisker"
  | "video"
  | "podcast"
  | "blog";

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  class?: string;
}

export function Icon(props: IconProps): JSX.Element {
  const size = () => props.size ?? 16;
  const stroke = () => props.color ?? "currentColor";
  const common = () => ({
    width: size(),
    height: size(),
    fill: "none",
    stroke: stroke(),
    "stroke-width": 1.6,
    "stroke-linecap": "round" as const,
    "stroke-linejoin": "round" as const,
    class: props.class,
  });

  switch (props.name) {
    case "menu":
      return (
        <svg {...common()} viewBox="0 0 16 16">
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      );
    case "close":
      return (
        <svg {...common()} viewBox="0 0 16 16">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common()} viewBox="0 0 16 16">
          <path d="M8 3v10M3 8h10" />
        </svg>
      );
    case "search":
      return (
        <svg {...common()} viewBox="0 0 16 16">
          <circle cx="7" cy="7" r="4.5" />
          <path d="m11 11 3 3" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common()} viewBox="0 0 16 16">
          <rect x="2" y="2" width="5" height="5" />
          <rect x="9" y="2" width="5" height="5" />
          <rect x="2" y="9" width="5" height="5" />
          <rect x="9" y="9" width="5" height="5" />
        </svg>
      );
    case "list":
      return (
        <svg {...common()} viewBox="0 0 16 16">
          <path d="M3 4h10M3 8h10M3 12h10" />
        </svg>
      );
    case "bookmark":
      return (
        <svg {...common()} viewBox="0 0 16 16">
          <path d="M4 2h8v12l-4-3-4 3z" />
        </svg>
      );
    case "whisker":
      return (
        <svg {...common()} viewBox="0 0 16 16" stroke-width="1.4">
          <circle cx="8" cy="9" r="4.2" />
          <path d="M8 9 v-1" />
          <path d="M2 7 l3.5 1.5M2 9.5 l3.5-0.5M14 7 l-3.5 1.5M14 9.5 l-3.5-0.5" />
          <circle cx="6.5" cy="8" r="0.4" fill={stroke()} />
          <circle cx="9.5" cy="8" r="0.4" fill={stroke()} />
        </svg>
      );
    case "video":
      return (
        <svg width={size()} height={size()} viewBox="0 0 16 16" fill="none" class={props.class}>
          <rect x="1" y="3" width="11" height="10" rx="2" stroke={stroke()} stroke-width="1.4" />
          <path d="M12 7 L15 5 V11 L12 9 Z" fill={stroke()} />
        </svg>
      );
    case "podcast":
      return (
        <svg width={size()} height={size()} viewBox="0 0 16 16" fill="none" class={props.class}>
          <rect x="6" y="2" width="4" height="8" rx="2" stroke={stroke()} stroke-width="1.4" />
          <path d="M3 8 a5 5 0 0 0 10 0" stroke={stroke()} stroke-width="1.4" fill="none" />
          <path d="M8 13 V15" stroke={stroke()} stroke-width="1.4" />
        </svg>
      );
    case "blog":
      return (
        <svg width={size()} height={size()} viewBox="0 0 16 16" fill="none" class={props.class}>
          <path
            d="M3 2 H10 L13 5 V14 H3 Z"
            stroke={stroke()}
            stroke-width="1.4"
            stroke-linejoin="round"
          />
          <path
            d="M5.5 7 H10.5 M5.5 9.5 H10.5 M5.5 12 H8"
            stroke={stroke()}
            stroke-width="1.2"
            stroke-linecap="round"
          />
        </svg>
      );
  }
}

export function entryTypeFromUrl(url: string | undefined): "video" | "podcast" | "blog" {
  if (!url) return "blog";
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be") || u.includes("vimeo.com")) {
    return "video";
  }
  if (u.endsWith(".mp3") || u.endsWith(".m4a") || u.includes("/podcast")) {
    return "podcast";
  }
  return "blog";
}
