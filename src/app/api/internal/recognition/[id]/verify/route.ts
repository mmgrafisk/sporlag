import { requireRole, json, err, EDITORIAL } from "@/lib/api";
import { verifyRecognition } from "@/lib/recognition";

export const dynamic = "force-dynamic";

/** POST /api/internal/recognition/:id/verify — human verification (§19, chain step 14). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const res = verifyRecognition(id, auth.user.id);
  if (!res.ok) return err(res.error ?? "auth.errGeneric", 400);
  return json({ ok: true });
}
