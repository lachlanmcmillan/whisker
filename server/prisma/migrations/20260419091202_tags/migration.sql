-- CreateTable
CREATE TABLE "TagDefinitions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_TagDefinitionsTofeeds" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_TagDefinitionsTofeeds_A_fkey" FOREIGN KEY ("A") REFERENCES "TagDefinitions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TagDefinitionsTofeeds_B_fkey" FOREIGN KEY ("B") REFERENCES "feeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TagDefinitions_name_key" ON "TagDefinitions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_TagDefinitionsTofeeds_AB_unique" ON "_TagDefinitionsTofeeds"("A", "B");

-- CreateIndex
CREATE INDEX "_TagDefinitionsTofeeds_B_index" ON "_TagDefinitionsTofeeds"("B");
