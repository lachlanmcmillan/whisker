import { useState } from "react";
import DOMPurify from "dompurify";
import type { FeedEntry } from "../models/feed.model";
import { Button } from "./Button";
import { CachedThumbnail } from "./CachedThumbnail";
import { Link } from "./Link";
import { Title } from "./Title";
import styles from "./entryItem.module.css";

export function EntryItem({ entry }: { entry: FeedEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className={styles.entry}>
      {entry.thumbnail && (
        <CachedThumbnail url={entry.thumbnail} width={120} alt={entry.title} />
      )}
      <div className={styles.entryBody}>
        <Title level={2}>
          <Link href={entry.link}>{entry.title}</Link>
        </Title>
        <p className={styles.meta}>
          by {entry.author} — {new Date(entry.published).toLocaleDateString()}
          {entry.updated &&
            ` — Updated: ${new Date(entry.updated).toLocaleDateString()}`}
        </p>
        {entry.description && (
          <p className={styles.description}>{entry.description}</p>
        )}
        {entry.content && (
          <>
            <Button variant="ghost" onClick={() => setExpanded(!expanded)}>
              {expanded ? "show less" : "show more..."}
            </Button>
            {expanded && (
              <div
                className={styles.content}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(entry.content),
                }}
              />
            )}
          </>
        )}
      </div>
    </li>
  );
}
