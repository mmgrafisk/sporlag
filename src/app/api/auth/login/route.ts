import { authenticate, createSession, sessionCookie, originAllowed } from "@/lib/auth";
import { json, err, body } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!originAllowed(request)) return err("auth.errCsrf", 403);
  const b = await body<{ email?: string; password?: string }>(request);
  const user = authenticate(b?.email ?? "", b?.password ?? "");
  if (!user) return err("account.error", 401);
  const session = createSession(user.id);
  const res = json({ ok: true, user: { name: user.name, role: user.role } });
  res.cookies.set(sessionCookie.name, session.id, { ...sessionCookie.options, expires: new Date(session.expiresAt) });
  return res;
}
