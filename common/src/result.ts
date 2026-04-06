export const ErrorCodes = {
  // feed
  feed_not_found: "No RSS or Atom feed found at this URL",
  feed_already_exists: "This feed already exists",
  fetch_failed: "Failed to fetch URL",
  parse_failed: "Failed to parse feed",

  // database
  db_query_failed: "Database query failed",
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export interface Err {
  data?: never;
  error: {
    code: ErrorCode;
    message: string;
    detail?: any;
  };
}

export interface Ok<T> {
  data: T;
  error?: never;
}

export type Result<T> = Ok<T> | Err;
export type AsyncResult<T> = Promise<Result<T>>;

export function ok<T>(data: T): Ok<T> {
  return { data };
}

export function err(code: ErrorCode, message?: string, detail?: any): Err {
  return {
    error: {
      code,
      message: message ?? ErrorCodes[code],
      detail,
    },
  };
}
