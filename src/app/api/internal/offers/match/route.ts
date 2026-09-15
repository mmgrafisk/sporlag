import { requireRole, json, err, body, EDITORIAL } from "@/lib/api";
import { q, q1, run, nextId, nowIso } from "@/lib/db";
import { suggestMatches, type ExistingOfferForMatch } from "@/lib/matching";
import { getExtractionFields } from "@/lib/queries";
import type { CandidateOffer, ExtractedField } from "@/lib/extractor";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/offers/match (§11)
 * Body: { extraction_id } → layered match suggestions with reason codes and
 * changed fields, persisted as reviewable match_candidates.
 */
export async function POST(request: Request) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;
  const b = await body<{ extraction_id?: string }>(request);
  if (!b?.extraction_id) return err("auth.errGeneric", 400);

  const ex = q1<{ id: string; message_id: string; offer_type: string; headline: string | null }>(
    `SELECT * FROM extractions WHERE id = ?`, b.extraction_id
  );
  if (!ex) return err("auth.errNotFound", 404);
  const msg = q1<{ received_at: string; source_id: string }>(
    `SELECT received_at, source_id FROM messages WHERE id = ?`, ex.message_id
  );
  if (!msg) return err("auth.errNotFound", 404);
  const src = q1<{ company_id: string }>(
    `SELECT company_id FROM newsletter_sources WHERE id = ?`, msg.source_id
  );
  if (!src) return err("auth.errNotFound", 404);

  const fields: ExtractedField[] = getExtractionFields(ex.id).map((f) => ({
    field: f.field,
    value: JSON.parse(f.value_json),
    evidence_span: f.evidence_span,
    locator_start: f.locator_start,
    locator_end: f.locator_end,
    confidence: f.confidence,
  }));
  const candidate: CandidateOffer = {
    is_offer: true,
    offer_type: (ex.offer_type ?? "other") as CandidateOffer["offer_type"],
    headline: ex.headline,
    supporting_claim: null,
    fields,
  };

  const existing: ExistingOfferForMatch[] = q<ExistingOfferForMatch & { fields_json: string }>(
    `SELECT o.id AS offer_id, o.company_id, o.offer_type, o.canonical_identity, o.last_seen, ov.fields_json
       FROM offers o
       JOIN offer_versions ov ON ov.offer_id = o.id
      WHERE o.company_id = ?
        AND ov.version = (SELECT MAX(version) FROM offer_versions WHERE offer_id = o.id)`,
    src.company_id
  ).map((r) => ({ ...r, latest_version_fields: JSON.parse(r.fields_json) }));

  const observedAt = new Date(msg.received_at);
  const suggestions = suggestMatches(src.company_id, candidate, existing, observedAt, (o) =>
    Math.round((observedAt.getTime() - new Date(o.last_seen).getTime()) / 86400000)
  );

  // replace pending candidates for this extraction, keep decided ones
  run(`DELETE FROM match_candidates WHERE extraction_id = ? AND reviewer_decision IS NULL`, ex.id);
  const saved = suggestions.map((s) => {
    const id = nextId("match", "match_candidates");
    run(
      `INSERT INTO match_candidates
        (id, extraction_id, candidate_offer_id, confidence, reason_codes_json, changed_fields_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id, ex.id, s.candidate_offer_id, s.confidence,
      JSON.stringify(s.reason_codes), JSON.stringify(s.changed_fields), nowIso()
    );
    logAudit(auth.user.id, "match.suggested", "match_candidate", id, {
      offer_id: s.candidate_offer_id, confidence: s.confidence,
    });
    return { id, ...s };
  });
  return json({ suggestions: saved });
}
