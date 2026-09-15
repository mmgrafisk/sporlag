import { destroySession, sessionCookie, originAllowed } from "@/lib/auth";
import { cookies } from "next/headers";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!originAllowed(request)) return json({ ok: false }, 403);
  const store = await cookies();
  const sid = store.get(sessionCookie.name)?.value;
  if (sid) destroySession(sid);
  const res = json({ ok: true });
  res.cookies.set(sessionCookie.name, "", { ...sessionCookie.options, maxAge: 0 });
  return res;
}
