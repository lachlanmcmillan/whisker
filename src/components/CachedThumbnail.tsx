import { createSignal, onMount, Show } from "solid-js";
import {
  readCachedThumbnail,
  writeCachedThumbnail,
} from "../models/thumbnailCache.model";

interface CachedThumbnailProps {
  url: string;
  width?: number;
  alt?: string;
}

export function CachedThumbnail(props: CachedThumbnailProps) {
  const [src, setSrc] = createSignal<string | null>(null);
  const [useFallback, setUseFallback] = createSignal(false);

  onMount(async () => {
    const cachedResult = await readCachedThumbnail(props.url);
    if (cachedResult.data) {
      setSrc(`data:${cachedResult.data.contentType};base64,${cachedResult.data.data}`);
      return;
    }

    try {
      const res = await fetch(props.url);
      if (!res.ok) {
        setUseFallback(true);
        return;
      }

      const contentType = res.headers.get("Content-Type") ?? "image/jpeg";
      const buffer = await res.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce(
          (acc, byte) => acc + String.fromCharCode(byte),
          ""
        )
      );

      await writeCachedThumbnail(props.url, base64, contentType);
      setSrc(`data:${contentType};base64,${base64}`);
    } catch {
      setUseFallback(true);
    }
  });

  return (
    <Show
      when={!useFallback()}
      fallback={<img src={props.url} width={props.width} alt={props.alt} />}
    >
      <Show when={src()}>
        <img src={src()!} width={props.width} alt={props.alt} />
      </Show>
    </Show>
  );
}
