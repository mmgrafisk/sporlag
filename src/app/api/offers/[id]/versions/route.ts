import { getPublishedOffer } from "@/lib/queries";
import { json, err } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/offers/:id/versions — published version history + diffs. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const offer = getPublishedOffer(id);
  if (!offer) return err("auth.errNotFound", 404);
  return json({
    versions: offer.publishedVersions.map((v) => ({
      id: v.id,
      version: v.version,
      observed_at: v.observed_at,
      claim_original: v.claim_original,
      source_language: v.source_language,
      fields: JSON.parse(v.fields_json),
      changed_fields: JSON.parse(v.changed_fields_json),
      published_at: v.published_at,
      predecessor_version_id: v.predecessor_version_id,
    })),
    changes: offer.changes.map((c) => ({
      field: c.field,
      old_value: JSON.parse(c.old_value_json),
      new_value: JSON.parse(c.new_value_json),
      changed_at: c.changed_at,
      evidence_ref: c.evidence_ref,
    })),
  });
}
