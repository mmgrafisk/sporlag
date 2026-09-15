import { getPublishedOffer } from "@/lib/queries";
import { json, err } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/offers/:id/recognition — only human-verified recognition is public (§11). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const offer = getPublishedOffer(id);
  if (!offer) return err("auth.errNotFound", 404);
  const r = offer.recognition;
  if (!r || !r.verified_by) return json({ recognition: null });
  return json({
    recognition: {
      status: r.status,
      method_version: r.method_version,
      dimensions: JSON.parse(r.dimensions_json),
      evidence_refs: JSON.parse(r.evidence_refs_json),
      sample_size: r.sample_size,
      decided_at: r.decided_at,
      verified_at: r.verified_at,
    },
  });
}
