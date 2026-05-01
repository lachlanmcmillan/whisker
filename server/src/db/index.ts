import { err, ok, type Result } from "@whisker/common";
import {
  Database,
  type Changes,
  type SQLQueryBindings,
  type Statement,
} from "bun:sqlite";

const dbPath = process.env.DB_PATH ?? "whisker.db";
const sqlite = new Database(dbPath);

sqlite.run("PRAGMA journal_mode = WAL");
sqlite.run("PRAGMA foreign_keys = ON");

/**
 * Tagged template for parameterized SQL: each `${value}` becomes a `?` and is
 * bound separately (values are never interpolated into the string).
 *
 * @example
 * sql<FeedRow>`SELECT * FROM feeds WHERE id = ${id}`.all();
 */
export function sql<T = unknown>(
  strings: TemplateStringsArray,
  ...values: SQLQueryBindings[]
): SqlTagged<T> {
  let text = "";
  const params: SQLQueryBindings[] = [];
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      text += "?";
      params.push(values[i]);
    }
  }
  const stmt = sqlite.query<T, any[]>(text);
  const bind = () => params as any[];
  return {
    all: () => stmt.all(...bind()),
    get: () => stmt.get(...bind()),
    run: () => stmt.run(...bind()),
    iterate: () => stmt.iterate(...bind()),
    values: () => stmt.values(...bind()),
    raw: () => stmt.raw(...bind()),
    get statement(): Statement<T, any[]> {
      return stmt;
    },
    sql: text,
    params,
  };
}

export interface SqlTagged<T> {
  all(): T[];
  get(): T | null;
  run(): Changes;
  iterate(): IterableIterator<T>;
  values(): Array<Array<string | bigint | number | boolean | Uint8Array>>;
  raw(): Array<Array<Uint8Array | null>>;
  readonly statement: Statement<T, any[]>;
  readonly sql: string;
  readonly params: readonly SQLQueryBindings[];
}

function safeQuery<T>(query: string, params?: any[]): Result<T[]> {
  try {
    return ok(sqlite.query<T, any[]>(query).all(...(params ?? [])));
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: query,
    });
  }
}

export interface DB extends Database {
  safeQuery<T>(query: string, params?: any[]): Result<T[]>;
  sql: typeof sql;
}

export const db: DB = Object.assign(sqlite, { safeQuery, sql });
