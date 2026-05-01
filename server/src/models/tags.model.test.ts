import { describe, it, expect, beforeAll, beforeEach } from "bun:test";

process.env.DB_PATH = ":memory:";

const { db } = await import("../db");
const { tags } = await import("./tags.model");

beforeAll(() => {
  db.run(`CREATE TABLE feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL UNIQUE,
    feedUrl TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    published TEXT NOT NULL DEFAULT '',
    image TEXT,
    fetchedAt TEXT,
    refreshIntervalMins INTEGER
  )`);
  db.run(`CREATE TABLE Tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`);
  db.run(`CREATE UNIQUE INDEX Tags_name_key ON Tags(name)`);
  db.run(`CREATE TABLE FeedTags (
    feedId INTEGER NOT NULL,
    tagId INTEGER NOT NULL,
    PRIMARY KEY (feedId, tagId),
    FOREIGN KEY (feedId) REFERENCES feeds(id) ON DELETE CASCADE,
    FOREIGN KEY (tagId) REFERENCES Tags(id) ON DELETE CASCADE
  )`);
});

beforeEach(() => {
  db.run("DELETE FROM FeedTags");
  db.run("DELETE FROM Tags");
  db.run("DELETE FROM feeds");
});

function makeFeed(link = "https://example.com/feed.xml"): number {
  const row = db
    .query<{ id: number }, [string, string]>(
      "INSERT INTO feeds (title, link) VALUES (?, ?) RETURNING id"
    )
    .get("Test Feed", link);
  return row!.id;
}

describe("tags.create", () => {
  it("trims whitespace from name", () => {
    const result = tags.create("  economics  ");
    expect(result.error).toBeUndefined();
    expect(result.data?.name).toBe("economics");
  });

  it("lowercases the name", () => {
    const result = tags.create("Economics");
    expect(result.error).toBeUndefined();
    expect(result.data?.name).toBe("economics");
  });

  it("rejects empty string", () => {
    const result = tags.create("");
    expect(result.error?.code).toBe("invalid_input");
  });

  it("rejects whitespace-only string", () => {
    const result = tags.create("   ");
    expect(result.error?.code).toBe("invalid_input");
  });

  it("rejects names over 32 chars", () => {
    const result = tags.create("x".repeat(33));
    expect(result.error?.code).toBe("invalid_input");
  });

  it("accepts names of exactly 32 chars", () => {
    const result = tags.create("x".repeat(32));
    expect(result.error).toBeUndefined();
  });

  it("returns existing tag instead of duplicating", () => {
    const a = tags.create("economics");
    const b = tags.create("ECONOMICS");
    expect(a.data?.id).toBe(b.data?.id);
    const all = tags.readAll();
    expect(all.data?.length).toBe(1);
  });
});

describe("tags.rename", () => {
  it("updates the name on success", () => {
    const created = tags.create("foo");
    const renamed = tags.rename(created.data!.id, "bar");
    expect(renamed.error).toBeUndefined();
    expect(renamed.data?.name).toBe("bar");
  });

  it("returns tag_conflict when name belongs to another tag", () => {
    const a = tags.create("foo");
    tags.create("bar");
    const renamed = tags.rename(a.data!.id, "bar");
    expect(renamed.error?.code).toBe("tag_conflict");
  });

  it("returns ok when renaming to current name", () => {
    const created = tags.create("foo");
    const renamed = tags.rename(created.data!.id, "FOO");
    expect(renamed.error).toBeUndefined();
    expect(renamed.data?.name).toBe("foo");
  });

  it("returns tag_not_found for unknown id", () => {
    const renamed = tags.rename(999, "foo");
    expect(renamed.error?.code).toBe("tag_not_found");
  });
});

describe("tags.remove", () => {
  it("deletes the tag", () => {
    const created = tags.create("foo");
    const removed = tags.remove(created.data!.id);
    expect(removed.error).toBeUndefined();
    expect(tags.readById(created.data!.id).data).toBeNull();
  });

  it("cascades to FeedTags rows", () => {
    const feedId = makeFeed();
    const tag = tags.create("foo").data!;
    tags.assign(feedId, { tagId: tag.id });
    tags.remove(tag.id);
    const rows = db
      .query<{ feedId: number }, []>("SELECT feedId FROM FeedTags")
      .all();
    expect(rows.length).toBe(0);
  });

  it("returns tag_not_found for unknown id", () => {
    const removed = tags.remove(999);
    expect(removed.error?.code).toBe("tag_not_found");
  });
});

describe("tags.assign", () => {
  it("attaches a tag to a feed by tagId", () => {
    const feedId = makeFeed();
    const tag = tags.create("foo").data!;
    const result = tags.assign(feedId, { tagId: tag.id });
    expect(result.error).toBeUndefined();
    expect(result.data?.id).toBe(tag.id);
    const list = tags.readForFeed(feedId).data!;
    expect(list.map((t) => t.name)).toEqual(["foo"]);
  });

  it("auto-creates a tag when assigning by name", () => {
    const feedId = makeFeed();
    const result = tags.assign(feedId, { name: "Economics" });
    expect(result.error).toBeUndefined();
    expect(result.data?.name).toBe("economics");
    const all = tags.readAll().data!;
    expect(all.length).toBe(1);
  });

  it("is idempotent when already attached", () => {
    const feedId = makeFeed();
    const tag = tags.create("foo").data!;
    tags.assign(feedId, { tagId: tag.id });
    const second = tags.assign(feedId, { tagId: tag.id });
    expect(second.error).toBeUndefined();
    const list = tags.readForFeed(feedId).data!;
    expect(list.length).toBe(1);
  });

  it("returns feed_not_found for unknown feed", () => {
    const tag = tags.create("foo").data!;
    const result = tags.assign(999, { tagId: tag.id });
    expect(result.error?.code).toBe("feed_not_found");
  });

  it("returns tag_not_found when tagId does not exist", () => {
    const feedId = makeFeed();
    const result = tags.assign(feedId, { tagId: 999 });
    expect(result.error?.code).toBe("tag_not_found");
  });
});

describe("tags.unassign", () => {
  it("detaches a tag from a feed", () => {
    const feedId = makeFeed();
    const tag = tags.create("foo").data!;
    tags.assign(feedId, { tagId: tag.id });
    const result = tags.unassign(feedId, tag.id);
    expect(result.error).toBeUndefined();
    expect(tags.readForFeed(feedId).data!.length).toBe(0);
  });

  it("is idempotent when not attached", () => {
    const feedId = makeFeed();
    const tag = tags.create("foo").data!;
    const result = tags.unassign(feedId, tag.id);
    expect(result.error).toBeUndefined();
  });
});

describe("tags.readForFeed", () => {
  it("returns only tags attached to that feed, sorted by id", () => {
    const feedA = makeFeed("https://a.example/feed.xml");
    const feedB = makeFeed("https://b.example/feed.xml");
    const t1 = tags.create("alpha").data!;
    const t2 = tags.create("beta").data!;
    const t3 = tags.create("gamma").data!;
    tags.assign(feedA, { tagId: t2.id });
    tags.assign(feedA, { tagId: t1.id });
    tags.assign(feedB, { tagId: t3.id });
    const aTags = tags.readForFeed(feedA).data!;
    expect(aTags.map((t) => t.id)).toEqual([t1.id, t2.id]);
    const bTags = tags.readForFeed(feedB).data!;
    expect(bTags.map((t) => t.name)).toEqual(["gamma"]);
  });
});

describe("tags.readAll", () => {
  it("returns tags sorted by name ascending", () => {
    tags.create("zebra");
    tags.create("alpha");
    tags.create("middle");
    const all = tags.readAll().data!;
    expect(all.map((t) => t.name)).toEqual(["alpha", "middle", "zebra"]);
  });
});
