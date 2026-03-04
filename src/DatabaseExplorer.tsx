import { useState, useEffect } from "react";
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
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sql, setSql] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCustomQuery, setIsCustomQuery] = useState(false);

  useEffect(() => {
    loadTables();
  }, []);

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
        const countRows = await query(`SELECT COUNT(*) as count FROM "${name}"`);
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
    setSql(tableQuery);
    try {
      const data = await query(tableQuery);
      setRows(data);
    } catch (e) {
      setError(String(e));
      setRows([]);
    }
  }

  async function runSql() {
    if (!sql.trim()) return;
    setError(null);
    setIsCustomQuery(true);
    setSelectedTable(null);
    try {
      const data = await query(sql);
      setRows(data);
      // Refresh table list in case of DDL/DML
      loadTables();
    } catch (e) {
      setError(String(e));
      setRows([]);
    }
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className={styles.explorer}>
      <Title>Database Explorer</Title>

      <div className={styles.tables}>
        {tables.map((t) => (
          <Button
            key={t.name}
            active={selectedTable === t.name}
            onClick={() => selectTable(t.name)}
          >
            {t.name}
            <span className={styles.tableInfo}>({t.count})</span>
          </Button>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {rows.length > 0 ? (
        <table className={styles.dataTable}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col}>{String(row[col] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        selectedTable &&
        !error && <p className={styles.empty}>No rows in this table.</p>
      )}

      {isCustomQuery && rows.length === 0 && !error && (
        <p className={styles.empty}>Query returned no rows.</p>
      )}

      <div className={styles.sqlSection}>
        <textarea
          className={styles.sqlInput}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
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
