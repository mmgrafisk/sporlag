/**
 * RECOGNITION ENGINE (§11 MASTER / §19 BUILD SPEC)
 * Working status: `clearly_documented` — display label comes from brand
 * config ("Tydeligt dokumenteret"), never hardcoded.
 * Recognition:
 *  - belongs to a concrete Offer Version
 *  - is explainable: dimensions, method version, timestamp, evidence refs, sample size
 *  - is suggested by the engine and VERIFIED BY A HUMAN before it counts
 *  - cannot be bought; implies no legal certification
 */
import { q, q1, run, nextId, nowIso } from "./db";
import { logAudit } from "./audit";

export const RECOGNITION_METHOD_VERSION = "recognition-method-0.1";

export type DimensionAssessment = {
  key: "claim_clarity" | "price_clarity" | "condition_visibility" | "time_clarity" | "promise_consistency";
  assessment: "met" | "partially_met" | "not_met" | "insufficient_data";
  rationale: string; // language-neutral key-ish note; UI renders label + rationale
};

export type RecognitionSuggestion = {
  status: "clearly_documented" | "insufficient_documentation";
  dimensions: DimensionAssessment[];
  evidence_refs: string[];
  sample_size: number;
};

function has(fields: Record<string, unknown>, f: string): boolean {
  return fields[f] !== undefined && fields[f] !== null;
}

/** Compute a recognition suggestion for a published, verified offer version. */
export function suggestRecognition(offerVersionId: string): RecognitionSuggestion | null {
  const v = q1<{
    id: string; fields_json: string; verification_status: string; publication_status: string;
  }>(`SELECT * FROM offer_versions WHERE id = ?`, offerVersionId);
  if (!v || v.verification_status !== "verified") return null;

  const fields = JSON.parse(v.fields_json) as Record<string, unknown>;
  const dims: DimensionAssessment[] = [];

  // 1. Claim clarity — claim + supporting context verified with evidence
  const claimOk = has(fields, "headline") || has(fields, "supporting_claim");
  dims.push({
    key: "claim_clarity",
    assessment: claimOk ? "met" : "not_met",
    rationale: claimOk ? "claim_verified_with_evidence" : "claim_missing_or_unverified",
  });

  // 2. Price clarity — advertised price present; if intro/discount exists,
  //    the price AFTER must also be documented (no hidden continuation price)
  const advOk = has(fields, "advertised_price");
  const hasIntro = has(fields, "intro_period"); // intro/period-based pricing implies a "price after"
  const postOk = has(fields, "normal_price") || has(fields, "price_after_intro");
  const priceOk = advOk && (!hasIntro || postOk);
  dims.push({
    key: "price_clarity",
    assessment: priceOk ? "met" : advOk && hasIntro && !postOk ? "not_met" : advOk ? "partially_met" : "not_met",
    rationale: priceOk ? "advertised_and_post_intro_price_documented"
      : advOk && hasIntro ? "post_intro_price_missing"
      : advOk ? "advertised_price_documented" : "advertised_price_missing",
  });

  // 3. Condition visibility — eligibility/restriction facts documented when the
  //    source mentions them; at minimum the extractor found explicit conditions
  const condFields = ["new_customers", "members_only", "binding_period", "minimum_purchase", "exclusions", "selected_products", "quantity_limits", "fees", "wager_requirement"];
  const condCount = condFields.filter((f) => has(fields, f)).length;
  const condOk = condCount >= 1 || !hasIntro; // simple one-off offer w/o conditions is acceptable
  dims.push({
    key: "condition_visibility",
    assessment: condOk ? (condCount >= 2 ? "met" : "partially_met") : "not_met",
    rationale: `conditions_documented:${condCount}`,
  });

  // 4. Time clarity — start/expiry or intro period documented
  const timeOk = has(fields, "expiry") || has(fields, "intro_period") || has(fields, "start_date") || !hasIntro;
  dims.push({
    key: "time_clarity",
    assessment: timeOk ? "met" : "not_met",
    rationale: timeOk ? "time_terms_documented" : "time_terms_missing",
  });

  // 5. Promise consistency — community does not contradict the documentation
  const agg = q1<{ n: number; responses: number; unclear: number }>(
    `SELECT COUNT(DISTINCT user_id) AS n,
            COUNT(*) AS responses,
            SUM(CASE WHEN response IN ('unclear','not_confirmed') THEN 1 ELSE 0 END) AS unclear
      FROM community_observations WHERE offer_version_id = ?`,
    offerVersionId
  );
  const n = agg?.n ?? 0; // sample size = distinct receivers (never inflated by question count)
  const responses = (agg?.responses ?? 0) as number;
  const negative = (agg?.unclear ?? 0) as number;
  let consistency: DimensionAssessment;
  if (n === 0) {
    consistency = { key: "promise_consistency", assessment: "insufficient_data", rationale: "no_community_data_yet" };
  } else if (negative / Math.max(1, responses) <= 0.25) {
    consistency = { key: "promise_consistency", assessment: "met", rationale: `community_sample:${n},contradictions:${negative}` };
  } else {
    consistency = { key: "promise_consistency", assessment: "not_met", rationale: `community_sample:${n},contradictions:${negative}` };
  }
  dims.push(consistency);

  const hardMet = dims.slice(0, 4).every((d) => d.assessment === "met" || d.assessment === "partially_met");
  const noFails = dims.every((d) => d.assessment !== "not_met");
  const status = hardMet && noFails ? "clearly_documented" : "insufficient_documentation";

  const evidenceRefs = q<{ evidence_ref: string }>(
    `SELECT evidence_ref FROM evidence WHERE offer_version_id = ? AND approved_for_public = 1`,
    offerVersionId
  ).map((r) => r.evidence_ref);

  return { status, dimensions: dims, evidence_refs: evidenceRefs, sample_size: n };
}

/** Store/refresh an engine suggestion (not human-verified yet). */
export function storeSuggestion(offerVersionId: string, actorId: string | null): RecognitionSuggestion | null {
  const s = suggestRecognition(offerVersionId);
  if (!s) return null;
  const existing = q1<{ id: string }>(`SELECT id FROM recognitions WHERE offer_version_id = ?`, offerVersionId);
  if (existing) {
    run(
      `UPDATE recognitions SET status = ?, dimensions_json = ?, evidence_refs_json = ?, sample_size = ?, suggested_by = 'engine', decided_at = ?
        WHERE id = ?`,
      s.status, JSON.stringify(s.dimensions), JSON.stringify(s.evidence_refs), s.sample_size, nowIso(), existing.id
    );
    logAudit(actorId, "recognition.suggested", "recognition", existing.id, { status: s.status });
    return s;
  }
  const id = nextId("recognition", "recognitions");
  run(
    `INSERT INTO recognitions
      (id, offer_version_id, status, method_version, dimensions_json, evidence_refs_json, sample_size, suggested_by, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'engine', ?)`,
    id, offerVersionId, s.status, RECOGNITION_METHOD_VERSION,
    JSON.stringify(s.dimensions), JSON.stringify(s.evidence_refs), s.sample_size, nowIso()
  );
  logAudit(actorId, "recognition.suggested", "recognition", id, { status: s.status });
  return s;
}

/** Human verification of a recognition (§20 chain step 14). */
export function verifyRecognition(recognitionId: string, editorId: string): { ok: boolean; error?: string } {
  const r = q1<{ id: string; verified_by: string | null }>(
    `SELECT id, verified_by FROM recognitions WHERE id = ?`, recognitionId
  );
  if (!r) return { ok: false, error: "not_found" };
  run(`UPDATE recognitions SET verified_by = ?, verified_at = ? WHERE id = ?`, editorId, nowIso(), recognitionId);
  logAudit(editorId, "recognition.verified", "recognition", recognitionId, {});
  return { ok: true };
}
