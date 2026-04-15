import { hostname } from "node:os";

type LogPayload = Record<string, unknown>;
type LogLevel = "info" | "error";

const host = hostname();

function serialize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(item => serialize(item, seen));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        serialize(entryValue, seen),
      ])
    );
  }

  return value;
}

function write(level: LogLevel, payload: LogPayload): void {
  const entry = serialize({
    ...payload,
    level,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    hostname: host,
  });
  const line = `${JSON.stringify(entry)}\n`;
  const stream = level === "error" ? process.stderr : process.stdout;

  try {
    stream.write(line);
  } catch (error) {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`[logger] failed to write log entry: ${message}\n`);
  }
}

export const logger = {
  info(payload: LogPayload): void {
    write("info", payload);
  },

  err(payload: LogPayload): void {
    write("error", payload);
  },
};
