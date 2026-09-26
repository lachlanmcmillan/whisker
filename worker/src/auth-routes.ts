import {
  authenticatedUser,
  createSession,
  expiredSessionCookie,
  hashPassword,
  isLoginBlocked,
  issueAccountToken,
  loginAttemptKey,
  normalizeEmail,
  publicUser,
  readAccountToken,
  recordFailedLogin,
  revokeSession,
  sessionCookie,
  tokenHash,
  validatePassword,
  verifyPassword,
  type UserRow,
} from "./auth";

interface AuthEnv {
  DB: D1Database;
  API_KEY?: string;
}

function response(data: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers();
  if (cookie) headers.set("Set-Cookie", cookie);
  headers.set("Cache-Control", "no-store");
  return Response.json({ data }, { status, headers });
}

function error(code: string, message: string, status: number): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function bodyObject(req: Request): Promise<Record<string, unknown>> {
  const body: unknown = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Expected a JSON object");
  return body as Record<string, unknown>;
}

function accountLink(
  req: Request,
  purpose: "setup" | "invite" | "reset",
  token: string
): string {
  return `${new URL(req.url).origin}/#${purpose}=${token}`;
}

export async function handleAuthRoute(
  req: Request,
  env: AuthEnv
): Promise<Response | null> {
  const path = new URL(req.url).pathname;
  if (!path.startsWith("/auth/")) return null;
  const db = env.DB;
  const method = req.method;

  try {
    if (path === "/auth/bootstrap" && method === "POST") {
      if (
        !env.API_KEY ||
        req.headers.get("Authorization") !== `Bearer ${env.API_KEY}`
      ) {
        return error("unauthorized", "Unauthorized", 401);
      }
      const body = await bodyObject(req);
      const email = normalizeEmail(body.email);
      const active = await db
        .prepare(
          "SELECT id FROM Users WHERE role = 'owner' AND passwordHash IS NOT NULL"
        )
        .first<{ id: string }>();
      if (active) return error("not_found", "Not found", 404);
      let pending = await db
        .prepare("SELECT * FROM Users WHERE role = 'owner'")
        .first<UserRow>();
      if (pending && pending.email !== email)
        return error(
          "conflict",
          "Owner setup is pending for another email",
          409
        );
      if (!pending) {
        const id = crypto.randomUUID();
        await db
          .prepare(
            "INSERT INTO Users (id, email, role, createdAt) VALUES (?, ?, 'owner', ?)"
          )
          .bind(id, email, new Date().toISOString())
          .run();
        pending = await db
          .prepare("SELECT * FROM Users WHERE id = ?")
          .bind(id)
          .first<UserRow>();
      }
      if (!pending) throw new Error("Owner setup failed");
      await db
        .prepare(
          "UPDATE AccountTokens SET usedAt = ? WHERE userId = ? AND purpose = 'setup' AND usedAt IS NULL"
        )
        .bind(new Date().toISOString(), pending.id)
        .run();
      const token = await issueAccountToken(db, {
        userId: pending.id,
        email,
        purpose: "setup",
      });
      return response({ setupUrl: accountLink(req, "setup", token) });
    }

    if (path === "/auth/token" && method === "POST") {
      const body = await bodyObject(req);
      const token = typeof body.token === "string" ? body.token : "";
      const row = await readAccountToken(db, token);
      return row ?
          response({ email: row.email, purpose: row.purpose })
        : error("invalid_token", "This link is invalid or has expired", 400);
    }

    if (path === "/auth/accept" && method === "POST") {
      const body = await bodyObject(req);
      const token = typeof body.token === "string" ? body.token : "";
      const row = await readAccountToken(db, token);
      if (!row)
        return error(
          "invalid_token",
          "This link is invalid or has expired",
          400
        );
      const passwordHash = await hashPassword(body.password);
      const now = new Date().toISOString();
      const hash = await tokenHash(token);
      let userId = row.userId;
      let statements: D1PreparedStatement[];
      if (row.purpose === "invite") {
        userId = crypto.randomUUID();
        statements = [
          db
            .prepare(
              `INSERT INTO Users (id, email, passwordHash, role, createdAt)
            SELECT ?, email, ?, 'member', ? FROM AccountTokens
            WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ?`
            )
            .bind(userId, passwordHash, now, hash, now),
          db
            .prepare(
              "UPDATE AccountTokens SET usedAt = ? WHERE tokenHash = ? AND usedAt IS NULL"
            )
            .bind(now, hash),
        ];
      } else {
        if (!userId)
          return error(
            "invalid_token",
            "This link is invalid or has expired",
            400
          );
        statements = [
          db
            .prepare(
              `UPDATE Users SET passwordHash = ? WHERE id = ? AND disabledAt IS NULL
            AND EXISTS (SELECT 1 FROM AccountTokens WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ?)`
            )
            .bind(passwordHash, userId, hash, now),
          db
            .prepare(
              "UPDATE AccountTokens SET usedAt = ? WHERE tokenHash = ? AND usedAt IS NULL"
            )
            .bind(now, hash),
          db.prepare("DELETE FROM Sessions WHERE userId = ?").bind(userId),
        ];
      }
      const results = await db.batch(statements);
      if (!results[0]?.meta.changes || !userId) {
        return error(
          "invalid_token",
          "This link is invalid or has expired",
          400
        );
      }
      const user = await db
        .prepare("SELECT * FROM Users WHERE id = ?")
        .bind(userId)
        .first<UserRow>();
      if (!user) throw new Error("Account setup failed");
      return response(
        publicUser(user),
        200,
        sessionCookie(await createSession(db, userId))
      );
    }

    if (path === "/auth/login" && method === "POST") {
      const body = await bodyObject(req);
      let email: string;
      try {
        email = normalizeEmail(body.email);
      } catch {
        return error("invalid_credentials", "Invalid email or password", 401);
      }
      if (typeof body.password !== "string")
        return error("invalid_credentials", "Invalid email or password", 401);
      const attemptKey = await loginAttemptKey(email, req);
      if (await isLoginBlocked(db, attemptKey))
        return error("rate_limited", "Try again in 15 minutes", 429);
      const user = await db
        .prepare("SELECT * FROM Users WHERE email = ?")
        .bind(email)
        .first<UserRow>();
      const valid = await verifyPassword(
        body.password,
        user?.passwordHash ?? null
      );
      if (!valid || !user || user.disabledAt) {
        await recordFailedLogin(db, attemptKey);
        return error("invalid_credentials", "Invalid email or password", 401);
      }
      await db
        .prepare("DELETE FROM LoginAttempts WHERE key = ?")
        .bind(attemptKey)
        .run();
      return response(
        publicUser(user),
        200,
        sessionCookie(await createSession(db, user.id))
      );
    }

    if (path === "/auth/logout" && method === "POST") {
      await revokeSession(db, req);
      return response(null, 200, expiredSessionCookie());
    }

    const user = await authenticatedUser(db, req);
    if (!user) return error("unauthorized", "Sign in required", 401);
    if (path === "/auth/me" && method === "GET")
      return response(publicUser(user));

    if (path === "/auth/password" && method === "POST") {
      const body = await bodyObject(req);
      if (
        typeof body.currentPassword !== "string" ||
        !(await verifyPassword(body.currentPassword, user.passwordHash))
      ) {
        return error(
          "invalid_credentials",
          "Current password is incorrect",
          401
        );
      }
      const passwordHash = await hashPassword(body.newPassword);
      await db.batch([
        db
          .prepare("UPDATE Users SET passwordHash = ? WHERE id = ?")
          .bind(passwordHash, user.id),
        db.prepare("DELETE FROM Sessions WHERE userId = ?").bind(user.id),
      ]);
      return response(
        publicUser(user),
        200,
        sessionCookie(await createSession(db, user.id))
      );
    }

    if (user.role !== "owner")
      return error("forbidden", "Owner access required", 403);

    if (path === "/auth/users" && method === "GET") {
      const { results } = await db
        .prepare(
          "SELECT id, email, role, createdAt, disabledAt FROM Users ORDER BY createdAt"
        )
        .all<Omit<UserRow, "passwordHash">>();
      return response(results);
    }

    if (path === "/auth/invites" && method === "POST") {
      const body = await bodyObject(req);
      const email = normalizeEmail(body.email);
      const existing = await db
        .prepare("SELECT id FROM Users WHERE email = ?")
        .bind(email)
        .first();
      if (existing)
        return error(
          "conflict",
          "An account with this email already exists",
          409
        );
      await db
        .prepare(
          "UPDATE AccountTokens SET usedAt = ? WHERE email = ? AND purpose = 'invite' AND usedAt IS NULL"
        )
        .bind(new Date().toISOString(), email)
        .run();
      const token = await issueAccountToken(db, {
        email,
        purpose: "invite",
        createdBy: user.id,
      });
      return response({ inviteUrl: accountLink(req, "invite", token) }, 201);
    }

    const resetMatch = /^\/auth\/users\/([^/]+)\/reset-link$/.exec(path);
    if (resetMatch && method === "POST") {
      const target = await db
        .prepare("SELECT * FROM Users WHERE id = ? AND disabledAt IS NULL")
        .bind(resetMatch[1])
        .first<UserRow>();
      if (!target) return error("user_not_found", "User not found", 404);
      await db
        .prepare(
          "UPDATE AccountTokens SET usedAt = ? WHERE userId = ? AND purpose = 'reset' AND usedAt IS NULL"
        )
        .bind(new Date().toISOString(), target.id)
        .run();
      const token = await issueAccountToken(db, {
        userId: target.id,
        email: target.email,
        purpose: "reset",
        createdBy: user.id,
      });
      return response({ resetUrl: accountLink(req, "reset", token) });
    }

    const disableMatch = /^\/auth\/users\/([^/]+)\/disable$/.exec(path);
    if (disableMatch && method === "POST") {
      if (disableMatch[1] === user.id)
        return error(
          "invalid_input",
          "You cannot disable your own account",
          400
        );
      const now = new Date().toISOString();
      const results = await db.batch([
        db
          .prepare(
            "UPDATE Users SET disabledAt = ? WHERE id = ? AND role = 'member' AND disabledAt IS NULL"
          )
          .bind(now, disableMatch[1]),
        db
          .prepare("DELETE FROM Sessions WHERE userId = ?")
          .bind(disableMatch[1]),
      ]);
      return results[0]?.meta.changes ?
          response(null)
        : error("user_not_found", "Active member not found", 404);
    }

    return error("not_found", "Not found", 404);
  } catch (cause) {
    if (
      cause instanceof SyntaxError ||
      (cause instanceof Error &&
        /^(Enter a valid email|Password must|Expected a JSON)/.test(
          cause.message
        ))
    ) {
      return error("invalid_input", cause.message, 400);
    }
    console.error("auth_failed", method, path, cause);
    return error("internal_error", "Request failed", 500);
  }
}
