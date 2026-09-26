export interface UserRow {
  id: string;
  email: string;
  passwordHash: string | null;
  role: "owner" | "member";
  createdAt: string;
  disabledAt: string | null;
}

export type PublicUser = Pick<
  UserRow,
  "id" | "email" | "role" | "createdAt" | "disabledAt"
>;

export interface AccountTokenRow {
  tokenHash: string;
  userId: string | null;
  email: string;
  purpose: "setup" | "invite" | "reset";
  expiresAt: string;
  usedAt: string | null;
}

export const COOKIE_NAME = "__Host-whisker_session";
export const SESSION_AGE_SECONDS = 30 * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 600_000;
const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export function randomToken(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function normalizeEmail(input: unknown): string {
  if (typeof input !== "string") throw new Error("Enter a valid email address");
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address");
  }
  return email;
}

export function validatePassword(input: unknown): string {
  if (typeof input !== "string" || input.length < 12 || input.length > 128) {
    throw new Error("Password must be 12 to 128 characters");
  }
  return input;
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(input: unknown): Promise<string> {
  const password = validatePassword(input);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null
): Promise<boolean> {
  if (!stored) {
    await derivePassword(password, new Uint8Array(16), PASSWORD_ITERATIONS);
    return false;
  }
  const [algorithm, count, encodedSalt, encodedHash] = stored.split("$");
  if (algorithm !== "pbkdf2-sha256" || !count || !encodedSalt || !encodedHash)
    return false;
  const iterations = Number(count);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 2_000_000)
    return false;
  const expected = base64UrlToBytes(encodedHash);
  const actual = await derivePassword(
    password,
    base64UrlToBytes(encodedSalt),
    iterations
  );
  let difference = expected.length ^ actual.length;
  for (
    let index = 0;
    index < Math.max(expected.length, actual.length);
    index++
  ) {
    difference |= (expected[index] ?? 0) ^ (actual[index] ?? 0);
  }
  return difference === 0;
}

function cookieValue(request: Request, name: string): string | null {
  const cookies = request.headers.get("Cookie")?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...parts] = cookie.trim().split("=");
    if (key === name) return parts.join("=");
  }
  return null;
}

export function sessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function expiredSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function sessionTokenHash(
  request: Request
): Promise<string | null> {
  const token = cookieValue(request, COOKIE_NAME);
  return token ? tokenHash(token) : null;
}

export async function authenticatedUser(
  db: D1Database,
  request: Request
): Promise<UserRow | null> {
  const hash = await sessionTokenHash(request);
  if (!hash) return null;
  return db
    .prepare(
      `SELECT u.* FROM Sessions s JOIN Users u ON u.id = s.userId
    WHERE s.tokenHash = ? AND s.expiresAt > ? AND u.disabledAt IS NULL AND u.passwordHash IS NOT NULL`
    )
    .bind(hash, new Date().toISOString())
    .first<UserRow>();
}

export async function createSession(
  db: D1Database,
  userId: string
): Promise<string> {
  const token = randomToken();
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO Sessions (tokenHash, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)"
    )
    .bind(
      await tokenHash(token),
      userId,
      new Date(now).toISOString(),
      new Date(now + SESSION_AGE_SECONDS * 1000).toISOString()
    )
    .run();
  return token;
}

export async function revokeSession(
  db: D1Database,
  request: Request
): Promise<void> {
  const hash = await sessionTokenHash(request);
  if (hash)
    await db
      .prepare("DELETE FROM Sessions WHERE tokenHash = ?")
      .bind(hash)
      .run();
}

export function publicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    disabledAt: user.disabledAt,
  };
}

export async function readAccountToken(
  db: D1Database,
  token: string
): Promise<AccountTokenRow | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return db
    .prepare(
      `SELECT tokenHash, userId, email, purpose, expiresAt, usedAt
    FROM AccountTokens WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ?`
    )
    .bind(await tokenHash(token), new Date().toISOString())
    .first<AccountTokenRow>();
}

export async function issueAccountToken(
  db: D1Database,
  input: {
    userId?: string;
    email: string;
    purpose: AccountTokenRow["purpose"];
    createdBy?: string;
  }
): Promise<string> {
  const token = randomToken();
  const now = Date.now();
  const age =
    input.purpose === "invite" || input.purpose === "setup"
      ? 7 * 24 * 60 * 60 * 1000
      : 60 * 60 * 1000;
  await db
    .prepare(
      `INSERT INTO AccountTokens
    (tokenHash, userId, email, purpose, createdBy, createdAt, expiresAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      await tokenHash(token),
      input.userId ?? null,
      input.email,
      input.purpose,
      input.createdBy ?? null,
      new Date(now).toISOString(),
      new Date(now + age).toISOString()
    )
    .run();
  return token;
}

export async function loginAttemptKey(
  email: string,
  request: Request
): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  return tokenHash(`${email}\n${ip}`);
}

export async function isLoginBlocked(
  db: D1Database,
  key: string
): Promise<boolean> {
  const row = await db
    .prepare("SELECT attempts, firstAt FROM LoginAttempts WHERE key = ?")
    .bind(key)
    .first<{ attempts: number; firstAt: string }>();
  return (
    !!row &&
    row.attempts >= 5 &&
    Date.now() - Date.parse(row.firstAt) < 15 * 60 * 1000
  );
}

export async function recordFailedLogin(
  db: D1Database,
  key: string
): Promise<void> {
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await db
    .prepare(
      `INSERT INTO LoginAttempts (key, attempts, firstAt) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      attempts = CASE WHEN firstAt < ? THEN 1 ELSE attempts + 1 END,
      firstAt = CASE WHEN firstAt < ? THEN excluded.firstAt ELSE firstAt END`
    )
    .bind(key, now, cutoff, cutoff)
    .run();
}
