import { createSignal, onMount, Show, For } from "solid-js";
import { sql } from "./lib/sqlite/sqlite";
import { Button } from "./components/Button";
import { Title } from "./components/Title";
import styles from "./DatabaseExplorer.module.css";
import type { Err } from "./lib/result";

interface TableInfo {
  name: string;
  count: number;
}

type Row = Record<string, unknown>;

export function DatabaseExplorer() {
  const [tables, setTables] = createSignal<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = createSignal<string | null>(null);
  const [rows, setRows] = createSignal<Row[]>([]);
  const [sqlText, setSqlText] = createSignal("");
  const [error, setError] = createSignal<Err | null>(null);
  const [isCustomQuery, setIsCustomQuery] = createSignal(false);
  const [sortColumn, setSortColumn] = createSignal<string | null>(null);
  const [sortDir, setSortDir] = createSignal<"ASC" | "DESC">("ASC");

  onMount(() => {
    loadTables();
  });

  async function query(sqlStr: string): Promise<Row[]> {
    // Use the sql template tag with the full query as the first string segment
    const strings = Object.assign([sqlStr], {
      raw: [sqlStr],
    }) as unknown as TemplateStringsArray;
    const result = await sql<Row>(strings);
    if (result.error) {
      setError(result);
      throw result.error;
    }
    return result.data;
  }

  async function loadTables() {
    const tableRows = await query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const infos: TableInfo[] = [];
    for (const row of tableRows) {
      const name = row.name as string;
      const countRows = await query(`SELECT COUNT(*) as count FROM "${name}"`);
      infos.push({ name, count: countRows[0]?.count as number });
    }
    setTables(infos);
  }

  function buildTableQuery(name: string, col: string | null, dir: "ASC" | "DESC") {
    let q = `SELECT * FROM "${name}"`;
    if (col) q += ` ORDER BY "${col}" ${dir}`;
    q += " LIMIT 200";
    return q;
  }

  async function selectTable(name: string) {
    setError(null);
    setIsCustomQuery(false);
    setSelectedTable(name);
    setSortColumn(null);
    setSortDir("ASC");
    const tableQuery = buildTableQuery(name, null, "ASC");
    setSqlText(tableQuery);
    const data = await query(tableQuery);
    setRows(data);
  }

  async function sortByColumn(col: string) {
    const table = selectedTable();
    if (!table) return;
    let dir: "ASC" | "DESC" = "ASC";
    if (sortColumn() === col) {
      dir = sortDir() === "ASC" ? "DESC" : "ASC";
    }
    setSortColumn(col);
    setSortDir(dir);
    setError(null);
    const tableQuery = buildTableQuery(table, col, dir);
    setSqlText(tableQuery);
    const data = await query(tableQuery);
    setRows(data);
  }

  async function runSql() {
    if (!sqlText().trim()) return;
    setError(null);
    setIsCustomQuery(true);
    setSelectedTable(null);
    const data = await query(sqlText());
    setRows(data);
    loadTables();
  }

  const columns = () => (rows().length > 0 ? Object.keys(rows()[0]) : []);

  return (
    <div class={styles.explorer}>
      <Title>Database Explorer</Title>

      <div class={styles.tables}>
        <For each={tables()}>
          {(t) => (
            <Button
              active={selectedTable() === t.name}
              onClick={() => selectTable(t.name)}
            >
              {t.name}
              <span class={styles.tableInfo}>({t.count})</span>
            </Button>
          )}
        </For>
      </div>

      <div class={styles.sqlSection}>
        <textarea
          class={styles.sqlInput}
          value={sqlText()}
          onInput={(e) => setSqlText(e.currentTarget.value)}
          placeholder="Enter SQL query..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              runSql();
            }
          }}
        />
        <Button onClick={runSql}>Run SQL</Button>
      </div>

      <Show when={error()}>
        <p class={styles.error}>{error()?.error.message}</p>
      </Show>

      <Show
        when={rows().length > 0}
        fallback={
          <>
            <Show when={selectedTable() && !error()}>
              <p class={styles.empty}>No rows in this table.</p>
            </Show>
            <Show when={isCustomQuery() && !error()}>
              <p class={styles.empty}>Query returned no rows.</p>
            </Show>
          </>
        }
      >
        <table class={styles.dataTable}>
          <thead>
            <tr>
              <For each={columns()}>
                {(col) => (
                  <th
                    class={selectedTable() ? styles.sortable : undefined}
                    onClick={() => selectedTable() && sortByColumn(col)}
                  >
                    {col}
                    <Show when={sortColumn() === col}>
                      {sortDir() === "ASC" ? " \u25B2" : " \u25BC"}
                    </Show>
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(row) => (
                <tr>
                  <For each={columns()}>
                    {(col) => <td>{String(row[col] ?? "")}</td>}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}
