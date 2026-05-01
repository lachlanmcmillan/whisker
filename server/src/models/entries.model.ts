import { type Result } from "@whisker/common";
import { db } from "../db";
import type { entriesModel } from "../generated/prisma/models";

export function readAll(): Result<entriesModel[]> {
  return db.safeQuery<entriesModel>("SELECT * FROM entries ORDER BY id");
}

export function readEntryById(
  feedId: number,
  entryId: string
): Result<entriesModel[]> {
  return db.safeQuery<entriesModel>(
    "SELECT * FROM entries WHERE feedId = ? AND entryId = ?",
    [feedId, entryId]
  );
}
