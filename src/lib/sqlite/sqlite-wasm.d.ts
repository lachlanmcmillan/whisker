declare module '@sqlite.org/sqlite-wasm' {
  interface SQLiteVersion {
    libVersion: string;
  }

  interface ConfigGetResponse {
    result: {
      version: SQLiteVersion;
    };
  }

  interface OpenResponse {
    dbId: string;
    result: {
      filename: string;
    };
  }

  interface ExecResponse {
    result: {
      message?: string;
    };
  }

  interface ExecRowsResponse {
    result: {
      resultRows: Record<string, unknown>[];
    };
  }

  interface SQLiteErrorResult {
    result: {
      message: string;
    };
  }

  type SQLitePromiser = {
    (command: 'config-get', args: Record<string, never>): Promise<ConfigGetResponse>;
    (command: 'open', args: { filename: string }): Promise<OpenResponse>;
    (command: 'exec', args: {
      dbId: string;
      sql: string;
      bind?: unknown[];
      returnValue: 'resultRows';
      rowMode: 'object';
    }): Promise<ExecRowsResponse>;
    (command: 'exec', args: { dbId: string; sql: string; bind?: unknown[] }): Promise<ExecResponse>;
    (command: 'close', args: { dbId: string }): Promise<ExecResponse>;
    (command: string, args: Record<string, unknown>): Promise<ExecResponse>;
  };

  export function sqlite3Worker1Promiser(config: {
    onready: () => void;
  }): SQLitePromiser;
}
