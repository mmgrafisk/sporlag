import { createUser, authenticate, createSession, sessionCookie } from "@/lib/auth";
import { originAllowed } from "@/lib/auth";
import { json, err, body } from "@/lib/api";
import { q1 } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!originAllowed(request)) return err("auth.errCsrf", 403);
  const b = await body<{ email?: string; name?: string; password?: string }>(request);
  const email = b?.email?.trim().toLowerCase() ?? "";
  const name = b?.name?.trim() ?? "";
  const password = b?.password ?? "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || name.length < 2 || password.length < 8) {
    return err("account.signupError", 400);
  }
  if (q1(`SELECT id FROM users WHERE email = ?`, email)) {
    return err("account.signupError", 409, { reason: "email_exists" });
  }
  createUser(email, name, password, "consumer");
  const user = authenticate(email, password);
  if (!user) return err("account.signupError", 500);
  const session = createSession(user.id);
  const res = json({ ok: true, user: { name: user.name, role: user.role } });
  res.cookies.set(sessionCookie.name, session.id, { ...sessionCookie.options, expires: new Date(session.expiresAt) });
  return res;
}
