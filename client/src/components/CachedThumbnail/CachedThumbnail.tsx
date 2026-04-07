interface CachedThumbnailProps {
  url: string;
  width?: number;
  alt?: string;
  class?: string;
}

export function CachedThumbnail(props: CachedThumbnailProps) {
  return (
    <img
      src={props.url}
      width={props.width}
      alt={props.alt}
      class={props.class}
      loading="lazy"
    />
  );
}
