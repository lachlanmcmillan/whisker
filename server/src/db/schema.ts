import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";

// prettier-ignore
export const feeds = sqliteTable("feeds", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  title:       text("title").notNull(),
  description: text("description").notNull().default(""),
  link:        text("link").notNull().unique(),
  feedUrl:     text("feedUrl").notNull().default(""),
  author:      text("author").notNull().default(""),
  published:   text("published").notNull().default(""),
  image:       text("image"),
  fetchedAt:   text("fetchedAt"),
});

// prettier-ignore
export const entries = sqliteTable(
  "entries",
  {
    id:          integer("id").primaryKey({ autoIncrement: true }),
    feedId:      integer("feedId").notNull().references(() => feeds.id, { onDelete: "cascade" }),
    entryId:     text("entryId").notNull(),
    title:       text("title").notNull().default(""),
    link:        text("link").notNull().default(""),
    author:      text("author").notNull().default(""),
    published:   text("published").notNull().default(""),
    updated:     text("updated"),
    description: text("description").notNull().default(""),
    thumbnail:   text("thumbnail"),
    content:     text("content"),
    openedAt:    text("openedAt"),
    archivedAt:  text("archivedAt"),
    starredAt:   text("starredAt"),
  },
  (t) => [unique().on(t.feedId, t.entryId)]
);
