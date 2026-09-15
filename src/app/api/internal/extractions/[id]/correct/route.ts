import { requireRole, json, err, body, EDITORIAL } from "@/lib/api";
import { applyFieldAction, markNotAnOffer, type FieldAction } from "@/lib/versioning";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/extractions/:id/correct (§10)
 * Per-field Confirm / Edit / Unknown — human corrections are retained with
 * the frozen AI prediction, evidence span, extractor version, reviewer and
 * timestamp (the Verified Offer Dataset).
 * Body: { field_id, action, value? } or { offer_action: "not_an_offer" }.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const b = await body<{
    field_id?: string; action?: string; value?: unknown; offer_action?: string;
  }>(request);

  if (b?.offer_action === "not_an_offer") {
    markNotAnOffer(id, auth.user.id);
    return json({ ok: true });
  }
  if (!b?.field_id || !b.action) return err("auth.errGeneric", 400);
  const action = b.action as FieldAction;
  if (!["confirm", "edit", "unknown"].includes(action)) return err("auth.errGeneric", 400);

  const res = applyFieldAction(b.field_id, action, auth.user.id, b.value);
  if (!res.ok) return err(res.error ?? "auth.errGeneric", 400);
  return json({ ok: true });
}
