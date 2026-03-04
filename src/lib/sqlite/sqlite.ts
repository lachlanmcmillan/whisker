import { sqlite3Worker1Promiser, type SQLitePromiser } from '@sqlite.org/sqlite-wasm';
import { MAX_MIGRATION, migrations } from './migrations';

interface DB {
  promiser: SQLitePromiser;
  dbId: string;
}

let db: DB | null = null;

async function runMigrations({ promiser, dbId }: DB): Promise<void> {
  const versionResult = await promiser('exec', {
    dbId,
    sql: 'PRAGMA user_version',
    returnValue: 'resultRows',
    rowMode: 'object',
  });

  const currentVersion = (versionResult.result.resultRows[0]?.user_version as number) ?? 0;

  for (const migration of migrations) {
    if (migration.version > MAX_MIGRATION) break;
    if (migration.version > currentVersion) {
      await promiser('exec', { dbId, sql: migration.sql });
      await promiser('exec', { dbId, sql: `PRAGMA user_version = ${migration.version}` });
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

  const openResponse = await promiser('open', {
    filename: 'file:xfraidycat.sqlite3?vfs=opfs',
  });

  const { dbId } = openResponse;

  await promiser('exec', { dbId, sql: 'PRAGMA foreign_keys = ON' });

  const instance: DB = { promiser, dbId };
  await runMigrations(instance);

  db = instance;

  // Expose a query helper on window for debugging via browser console:
  //   await sql("SELECT * FROM feeds")
  //   await sql("SELECT * FROM entries WHERE feed_id = 1")
  (window as unknown as Record<string, unknown>).sql = async (query: string) => {
    const result = await instance.promiser('exec', {
      dbId: instance.dbId,
      sql: query,
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    console.table(result.result.resultRows);
    return result.result.resultRows;
  };
}

export function getDB(): DB {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
}

type SqlValue = string | number | null | Uint8Array;

export async function sql<T = Record<string, SqlValue>>(
  strings: TemplateStringsArray,
  ...values: SqlValue[]
): Promise<T[]> {
  const { promiser, dbId } = getDB();

  const query = strings.join('?');
  const bind = values.length > 0 ? values : undefined;

  const result = await promiser('exec', {
    dbId,
    sql: query,
    bind,
    returnValue: 'resultRows',
    rowMode: 'object',
  });

  return result.result.resultRows as T[];
}
