-- Drop legacy Drizzle migrations table
DROP TABLE IF EXISTS "__drizzle_migrations";

-- AlterTable
ALTER TABLE "entries" ADD COLUMN "archivedAt" TEXT;
ALTER TABLE "entries" ADD COLUMN "starredAt" TEXT;
