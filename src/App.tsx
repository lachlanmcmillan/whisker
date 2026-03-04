import { useEffect, useState } from "react";
import { parseAtomFeed } from "./lib/atom/parse";
import { parseRssFeed } from "./lib/rss/parse";
import type { Feed } from "./models/feed.model";
import { EntryItem } from "./components/EntryItem";
import { Button } from "./components/Button";
import { Title } from "./components/Title";
import { DatabaseExplorer } from "./DatabaseExplorer";
import { readAllFeeds, upsertFeed } from "./models/feed.model";
import atomXml from "../yt-asionometry.xml?raw";
import rssXml from "../substack-signull.xml?raw";
import styles from "./App.module.css";

function App() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"feeds" | "explorer">("feeds");

  useEffect(() => {
    (async () => {
      let loaded = await readAllFeeds();

      if (loaded.length === 0) {
        await upsertFeed(parseAtomFeed(atomXml));
        await upsertFeed(parseRssFeed(rssXml));
        loaded = await readAllFeeds();
      }

      setFeeds(loaded);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className={styles.feed}>Loading feeds...</div>;
  }

  if (view === "explorer") {
    return (
      <div>
        <div className={styles.feed}>
          <nav className={styles.tabs}>
            <Button onClick={() => setView("feeds")}>Back to Feeds</Button>
          </nav>
        </div>
        <DatabaseExplorer />
      </div>
    );
  }

  const feed = feeds[activeIndex];
  if (!feed) return null;

  return (
    <div className={styles.feed}>
      <nav className={styles.tabs}>
        {feeds.map((f, i) => (
          <Button
            key={f.link}
            active={i === activeIndex}
            onClick={() => setActiveIndex(i)}
          >
            {f.title}
          </Button>
        ))}
        <Button onClick={() => setView("explorer")}>DB Explorer</Button>
      </nav>

      <div className={styles.feedHeader}>
        <Title>{feed.title}</Title>
        <p>
          by {feed.author} — {new Date(feed.published).toLocaleDateString()}
        </p>
        {feed.description && <p>{feed.description}</p>}
      </div>

      <ul className={styles.entries}>
        {feed.entries.map((entry) => (
          <EntryItem key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

export default App;
