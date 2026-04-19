import { err, ok } from "@whisker/common";
import { db } from "../db";
import { json } from "../lib/http";

export async function handleQuery(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const body = await req.json();
  if (!body.sql)
    return json(
      err("db_query_failed", "sql is required", {
        method: req.method,
        pathname: url.pathname,
        bodyKeys: body && typeof body === "object" ? Object.keys(body) : null,
      }),
      400
    );

  try {
    const stmt = db.query(body.sql);
    const rows = stmt.all();
    return json(ok(rows));
  } catch (e) {
    return json(
      err("db_query_failed", e instanceof Error ? e.message : String(e), {
        method: req.method,
        pathname: url.pathname,
        sql: body.sql,
      }),
      400
    );
  }
}
