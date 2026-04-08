import { Database } from "bun:sqlite";
import { execSync } from "child_process";

const dbPath = process.env.DB_PATH ?? "whisker.db";
const db = new Database(dbPath);

// Check if _prisma_migrations table exists (first-time Prisma adoption)
const hasPrisma = db.query(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'"
).get();

if (!hasPrisma) {
  console.log("First Prisma run — baselining 0_init...");
  execSync("bunx prisma migrate resolve --applied 0_init", { stdio: "inherit" });
}

db.close();

// Apply any pending migrations
console.log("Running prisma migrate deploy...");
execSync("bunx prisma migrate deploy", { stdio: "inherit" });
