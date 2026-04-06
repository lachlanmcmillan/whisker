import { createSignal, onMount, Show, For } from "solid-js";
import { query } from "./lib/api";
import { Button } from "./components/Button";
import { Title } from "./components/Title";
import styles from "./DatabaseExplorer.module.css";

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
  const [error, setError] = createSignal<string | null>(null);
  const [isCustomQuery, setIsCustomQuery] = createSignal(false);
  const [sortColumn, setSortColumn] = createSignal<string | null>(null);
  const [sortDir, setSortDir] = createSignal<"ASC" | "DESC">("ASC");

  onMount(() => {
    loadTables();
  });

  async function runQuery(sql: string): Promise<Row[]> {
    const data = await query(sql);
    return data;
  }

  async function loadTables() {
    try {
      const tableRows = await runQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );
      const infos: TableInfo[] = [];
      for (const row of tableRows) {
        const name = row.name as string;
        const countRows = await runQuery(`SELECT COUNT(*) as count FROM "${name}"`);
        infos.push({ name, count: countRows[0]?.count as number });
      }
      setTables(infos);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
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
    try {
      const data = await runQuery(tableQuery);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
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
    try {
      const data = await runQuery(tableQuery);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function runSql() {
    if (!sqlText().trim()) return;
    setError(null);
    setIsCustomQuery(true);
    setSelectedTable(null);
    try {
      const data = await runQuery(sqlText());
      setRows(data);
      loadTables();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
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
        <p class={styles.error}>{error()}</p>
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
