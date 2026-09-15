import { requireRole, json, err, EDITORIAL } from "@/lib/api";
import { getExtractionsForMessage, getExtractionFields, getMatchCandidates } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** GET /api/internal/messages/:id/extractions — candidate offers + provenance. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const extractions = getExtractionsForMessage(id);
  return json({
    extractions: extractions.map((e) => ({
      id: e.id,
      offer_index: e.offer_index,
      extractor_version: e.extractor_version,
      offer_type: e.offer_type,
      headline: e.headline,
      claim_original: e.claim_original,
      status: e.status,
      is_offer: !!e.is_offer,
      fields: getExtractionFields(e.id).map((f) => ({
        id: f.id,
        field: f.field,
        value: JSON.parse(f.value_json),
        evidence_span: f.evidence_span,
        locator: { type: "text_span", start: f.locator_start, end: f.locator_end },
        confidence: f.confidence,
        extractor_version: f.extractor_version,
        verification_status: f.verification_status,
      })),
      match_candidates: getMatchCandidates(e.id).map((m) => ({
        id: m.id,
        candidate_offer_id: m.candidate_offer_id,
        confidence: m.confidence,
        reason_codes: JSON.parse(m.reason_codes_json),
        changed_fields: JSON.parse(m.changed_fields_json),
        reviewer_decision: m.reviewer_decision,
        claim_original: m.claim_original,
        version: m.version,
      })),
    })),
  });
}
