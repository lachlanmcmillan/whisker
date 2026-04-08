-- CreateTable
CREATE TABLE "entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "feedId" INTEGER NOT NULL,
    "entryId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL DEFAULT '',
    "published" TEXT NOT NULL DEFAULT '',
    "updated" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "thumbnail" TEXT,
    "content" TEXT,
    "openedAt" TEXT,
    CONSTRAINT "entries_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "feeds" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "feeds" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL DEFAULT '',
    "published" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "fetchedAt" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "entries_feedId_entryId_key" ON "entries"("feedId", "entryId");

-- CreateIndex
CREATE UNIQUE INDEX "feeds_link_key" ON "feeds"("link");

