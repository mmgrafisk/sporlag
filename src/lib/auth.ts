/**
 * Auth & roles (§22 BUILD_SPEC)
 * - Roles: consumer | ambassador | editor | admin | b2b_user (language-neutral)
 * - Authorization enforced SERVER-SIDE (route handlers + server components)
 * - scrypt password hashing, opaque session ids in HttpOnly cookie
 *   (SameSite=None; Secure in production so preview iframes can keep a session)
 * - Cookie/session naming is brand-neutral (rebrandability §24)
 */
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { cache } from "react";
import { q, q1, run, nextId, nowIso } from "./db";

export const ROLES = ["consumer", "ambassador", "editor", "admin", "b2b_user"] as const;
export type Role = (typeof ROLES)[number];

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  locale: string;
};

export const EDITORIAL_ROLES: Role[] = ["ambassador", "editor", "admin"];

const COOKIE_NAME = "app_session"; // brand-neutral
const SESSION_DAYS = 14;

let secretCache: string | null = null;
function secret(): string {
  if (secretCache) return secretCache;
  if (process.env.SESSION_SECRET) {
    secretCache = process.env.SESSION_SECRET;
    return secretCache;
  }
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "secret.key");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  secretCache = fs.readFileSync(file, "utf8").trim();
  return secretCache;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt + secret(), 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt + secret(), 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createSession(userId: string): { id: string; expiresAt: string } {
  const id = randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  run(`INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
    id, userId, nowIso(), expires);
  return { id, expiresAt: expires };
}

export function destroySession(sessionId: string) {
  run(`DELETE FROM sessions WHERE id = ?`, sessionId);
}

/** Resolve current user from cookie (server-side). One JOIN, per-request cache. */
export const currentUser = cache(async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const sid = store.get(COOKIE_NAME)?.value;
  if (!sid) return null;
  const row = q1<{
    session_id: string; expires_at: string;
    id: string; email: string; name: string; role: Role; locale: string;
  }>(
    `SELECT s.id AS session_id, s.expires_at, u.id, u.email, u.name, u.role, u.locale
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`, sid
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(row.session_id);
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, locale: row.locale };
});

export function createUser(
  email: string,
  name: string,
  password: string,
  role: Role = "consumer"
): SessionUser {
  const id = nextId("user", "users");
  run(
    `INSERT INTO users (id, email, name, password_hash, role, locale, created_at)
     VALUES (?, ?, ?, ?, ?, 'da-DK', ?)`,
    id, email.toLowerCase().trim(), name.trim(), hashPassword(password), role, nowIso()
  );
  run(
    `INSERT INTO contributor_profiles (user_id, contribution_points, reputation, impact_count)
     VALUES (?, 0, 50, 0)`,
    id
  );
  return { id, email: email.toLowerCase().trim(), name: name.trim(), role, locale: "da-DK" };
}

export function authenticate(email: string, password: string): SessionUser | null {
  const row = q1<{ id: string; email: string; name: string; password_hash: string; role: Role; locale: string }>(
    `SELECT * FROM users WHERE email = ?`, email.toLowerCase().trim()
  );
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, locale: row.locale };
}

/**
 * Preview/iframe (e2b, Arena) is a cross-site embed. SameSite=Strict cookies
 * never stick there, so login appears to "do nothing". SameSite=None; Secure
 * is required on HTTPS. CSRF is still enforced via originAllowed().
 */
const behindHttps = process.env.NODE_ENV === "production";
export const sessionCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    sameSite: (behindHttps ? "none" : "lax") as "none" | "lax",
    secure: behindHttps,
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  },
};

function hostName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.split(",")[0]!.trim().replace(/^https?:\/\//, "").replace(/:\d+$/, "").toLowerCase();
}

function isPreviewHost(host: string): boolean {
  return (
    host.endsWith(".e2b.app") ||
    host.endsWith(".e2b.dev") ||
    host.endsWith(".appdeploy.ai")
  );
}

/** CSRF-ish origin check for mutating requests (§27). */
export function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = hostName(new URL(origin).host);
    const candidates = [
      hostName(request.headers.get("x-forwarded-host")),
      hostName(request.headers.get("host")),
      hostName(new URL(request.url).host),
    ].filter(Boolean);
    if (candidates.includes(originHost)) return true;
    // Preview proxies bind to 0.0.0.0 and may omit x-forwarded-host.
    const bind = candidates.some((h) => h === "0.0.0.0" || h === "127.0.0.1" || h === "localhost");
    if (bind && isPreviewHost(originHost)) return true;
    if (isPreviewHost(originHost)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Simple sliding-window rate limit for community contributions (§27). */
export function rateLimit(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = q1<{ count: number; window_start: string }>(
    `SELECT count, window_start FROM rate_buckets WHERE bucket_key = ?`, key
  );
  if (!bucket || now - new Date(bucket.window_start).getTime() > windowMs) {
    run(
      `INSERT INTO rate_buckets (bucket_key, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(bucket_key) DO UPDATE SET count = 1, window_start = excluded.window_start`,
      key, new Date(now).toISOString()
    );
    return true;
  }
  if (bucket.count >= max) return false;
  run(`UPDATE rate_buckets SET count = count + 1 WHERE bucket_key = ?`, key);
  return true;
}

/** Fingerprint helper for duplicate protection (§27). */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function listUsers(): SessionUser[] {
  return q<SessionUser>(`SELECT id, email, name, role, locale FROM users ORDER BY created_at`);
}
