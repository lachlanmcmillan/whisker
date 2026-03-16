import { useEffect, useState } from "react";
import {
  readCachedThumbnail,
  writeCachedThumbnail,
} from "../models/thumbnailCache.model";

interface CachedThumbnailProps {
  url: string;
  width?: number;
  alt?: string;
}

export function CachedThumbnail({ url, width, alt }: CachedThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = await readCachedThumbnail(url);
      if (cached) {
        if (!cancelled) setSrc(`data:${cached.contentType};base64,${cached.data}`);
        return;
      }

      try {
        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) setUseFallback(true);
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

        await writeCachedThumbnail(url, base64, contentType);
        if (!cancelled) setSrc(`data:${contentType};base64,${base64}`);
      } catch {
        // CORS or network error — fall back to direct <img> load
        if (!cancelled) setUseFallback(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (useFallback) return <img src={url} width={width} alt={alt} />;
  if (!src) return null;

  return <img src={src} width={width} alt={alt} />;
}
