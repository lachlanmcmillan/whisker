import { createSignal, onMount, Show, For } from "solid-js";
import { getDB } from "./lib/sqlite/sqlite";
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

  onMount(() => {
    loadTables();
  });

  async function query(sqlStr: string): Promise<Row[]> {
    const { promiser, dbId } = getDB();
    const result = await promiser("exec", {
      dbId,
      sql: sqlStr,
      returnValue: "resultRows",
      rowMode: "object",
    });
    return result.result.resultRows as Row[];
  }

  async function loadTables() {
    try {
      const tableRows = await query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );
      const infos: TableInfo[] = [];
      for (const row of tableRows) {
        const name = row.name as string;
        const countRows = await query(
          `SELECT COUNT(*) as count FROM "${name}"`
        );
        infos.push({ name, count: countRows[0]?.count as number });
      }
      setTables(infos);
    } catch (e) {
      setError(String(e));
    }
  }

  async function selectTable(name: string) {
    setError(null);
    setIsCustomQuery(false);
    setSelectedTable(name);
    const tableQuery = `SELECT * FROM "${name}" LIMIT 200`;
    setSqlText(tableQuery);
    try {
      const data = await query(tableQuery);
      setRows(data);
    } catch (e) {
      setError(String(e));
      setRows([]);
    }
  }

  async function runSql() {
    if (!sqlText().trim()) return;
    setError(null);
    setIsCustomQuery(true);
    setSelectedTable(null);
    try {
      const data = await query(sqlText());
      setRows(data);
      loadTables();
    } catch (e) {
      setError(String(e));
      setRows([]);
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
              <For each={columns()}>{(col) => <th>{col}</th>}</For>
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
    </div>
  );
}
