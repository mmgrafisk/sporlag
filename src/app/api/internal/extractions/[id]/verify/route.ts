import { requireRole, json, err, EDITORIAL } from "@/lib/api";
import { verifyExtraction } from "@/lib/versioning";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/extractions/:id/verify (§7)
 * Verification requires every field to have a human action.
 * Verification is NOT publication — publishing is a separate explicit step.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const res = verifyExtraction(id, auth.user.id);
  if (!res.ok) return err(res.error ?? "auth.errGeneric", 400);
  return json({ ok: true });
}
