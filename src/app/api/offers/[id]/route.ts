import { getPublishedOffer } from "@/lib/queries";
import { json, err } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/offers/:id — PUBLIC PROJECTION ONLY (§21):
 * approved structured facts, approved evidence excerpts, history,
 * community aggregate, recognition. No message bodies, no subjects,
 * no internal extraction traces.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const offer = getPublishedOffer(id);
  if (!offer) return err("auth.errNotFound", 404);

  return json({
    offer: {
      id: offer.offer_id,
      company: { id: offer.company_id, name: offer.company_name, slug: offer.company_slug },
      campaign: offer.campaign_name,
      offer_type: offer.offer_type,
      first_seen: offer.first_seen,
      last_seen: offer.last_seen,
      latest_version: {
        id: offer.latest.id,
        version: offer.latest.version,
        claim_original: offer.latest.claim_original,
        source_language: offer.latest.source_language,
        observed_at: offer.latest.observed_at,
        fields: JSON.parse(offer.latest.fields_json),
        published_at: offer.latest.published_at,
      },
      versions: offer.publishedVersions.map((v) => ({
        id: v.id, version: v.version, observed_at: v.observed_at,
        claim_original: v.claim_original, changed_fields: JSON.parse(v.changed_fields_json),
      })),
      evidence: offer.evidence.map((e) => ({
        ref: e.evidence_ref, field: e.field, excerpt: e.evidence_span,
      })),
      changes: offer.changes.map((c) => ({
        field: c.field,
        old_value: JSON.parse(c.old_value_json),
        new_value: JSON.parse(c.new_value_json),
        changed_at: c.changed_at,
        evidence_ref: c.evidence_ref,
        version: offer.versions.find((v) => v.id === c.successor_version_id)?.version ?? null,
      })),
      community: offer.summary,
      recognition:
        offer.recognition && offer.recognition.verified_by
          ? {
              status: offer.recognition.status,
              method_version: offer.recognition.method_version,
              dimensions: JSON.parse(offer.recognition.dimensions_json),
              sample_size: offer.recognition.sample_size,
              decided_at: offer.recognition.decided_at,
            }
          : null,
    },
  });
}
