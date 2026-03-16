import {
  sqlite3Worker1Promiser,
  type SQLitePromiser,
} from "@sqlite.org/sqlite-wasm";
import { MAX_MIGRATION, migrations } from "./migrations";
import { ok, err, type Result, type AsyncResult } from "../result";

interface DB {
  promiser: SQLitePromiser;
  dbId: string;
}

let db: DB | null = null;

async function runMigrations({ promiser, dbId }: DB): Promise<void> {
  const versionResult = await promiser("exec", {
    dbId,
    sql: "PRAGMA user_version",
    returnValue: "resultRows",
    rowMode: "object",
  });

  const currentVersion =
    (versionResult.result.resultRows[0]?.user_version as number) ?? 0;

  for (const migration of migrations) {
    if (migration.version > MAX_MIGRATION) break;
    if (migration.version > currentVersion) {
      await promiser("exec", { dbId, sql: migration.sql });
      await promiser("exec", {
        dbId,
        sql: `PRAGMA user_version = ${migration.version}`,
      });
    }
  }
}

export async function initDB(): Promise<void> {
  if (db) return;

  const promiser = await new Promise<SQLitePromiser>((resolve) => {
    const _promiser = sqlite3Worker1Promiser({
      onready: () => resolve(_promiser),
    });
  });

  const openResponse = await promiser("open", {
    filename: "file:xfraidycat.sqlite3?vfs=opfs",
  });

  const { dbId } = openResponse;

  await promiser("exec", { dbId, sql: "PRAGMA foreign_keys = ON" });

  const instance: DB = { promiser, dbId };
  await runMigrations(instance);

  db = instance;

  // Expose a query helper on window for debugging via browser console:
  //   await sql("SELECT * FROM feeds")
  //   await sql("SELECT * FROM entries WHERE feed_id = 1")
  (window as unknown as Record<string, unknown>).sql = async (
    query: string
  ) => {
    const result = await instance.promiser("exec", {
      dbId: instance.dbId,
      sql: query,
      returnValue: "resultRows",
      rowMode: "object",
    });
    console.table(result.result.resultRows);
    return result.result.resultRows;
  };
}

function getDB(): Result<DB> {
  if (!db) {
    return err(
      "db_not_initialized",
      "Database not initialized. Call initDB() first."
    );
  }
  return ok(db);
}

function getErrorProperties(e: Error): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  props.message = e.message;
  props.name = e.name;
  if (e.stack) props.stack = e.stack;

  return props;
}

type SqlValue = string | number | null | Uint8Array;

export async function sql<T = Record<string, SqlValue>>(
  strings: TemplateStringsArray,
  ...values: SqlValue[]
): AsyncResult<T[]> {
  const dbResult = getDB();
  if (dbResult.error) return dbResult;

  const { promiser, dbId } = dbResult.data;
  const query = strings.join("?");
  const bind = values.length > 0 ? values : undefined;

  try {
    const result = await promiser("exec", {
      dbId,
      sql: query,
      bind,
      returnValue: "resultRows",
      rowMode: "object",
    });

    return ok(result.result.resultRows as T[]);
  } catch (e: any) {
    // standard sqlite3 error
    if (typeof e === "object" && e !== null && "type" in e && "result" in e) {
      console.log("sqlite3 error", e);
      return err("db_query_failed", e.result.message!, {
        error: e.result,
        query,
        bind,
      });
    }

    if (e instanceof Error) {
      return err("db_query_failed", e.message, {
        error: getErrorProperties(e),
        query,
        bind,
      });
    }

    return err("db_query_failed", "Unknown database error", {
      error: e,
      query,
      bind,
    });
  }
}
