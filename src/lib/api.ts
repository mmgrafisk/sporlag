/**
 * API route helpers — server-side authorization (§22), CSRF origin check
 * and rate limits (§27), consistent JSON envelope.
 */
import { NextResponse } from "next/server";
import { currentUser, originAllowed, rateLimit, type Role, type SessionUser } from "./auth";

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

export const err = (key: string, status: number, extra?: Record<string, unknown>) =>
  NextResponse.json({ error: key, ...extra }, { status });

export type Authed = { user: SessionUser } | { error: NextResponse };

export async function requireUser(request: Request): Promise<Authed> {
  if (!originAllowed(request)) return { error: err("auth.errCsrf", 403) };
  const user = await currentUser();
  if (!user) return { error: err("auth.errUnauthorized", 401) };
  return { user };
}

export async function requireRole(request: Request, roles: Role[]): Promise<Authed> {
  const auth = await requireUser(request);
  if ("error" in auth) return auth;
  if (!roles.includes(auth.user.role)) return { error: err("auth.errForbidden", 403) };
  return auth;
}

export const EDITORIAL: Role[] = ["ambassador", "editor", "admin"];
export const ADMIN: Role[] = ["admin"];

export async function body<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/** Rate limit guard for community contributions. */
export function contributionAllowed(request: Request, user: SessionUser): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return rateLimit(`contrib:${user.id}`, 40, 60_000) && rateLimit(`contrib-ip:${ip}`, 120, 60_000);
}
