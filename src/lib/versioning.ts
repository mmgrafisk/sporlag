/**
 * OFFER GRAPH WRITE-SIDE (§3–§7, §12 BUILD SPEC)
 * Message state machine, verification, version creation + change detection,
 * publication projection, community tasks, recognition engine.
 *
 * Rules enforced here:
 *  - Verification ≠ publication (explicit transitions only, §7)
 *  - No derived fact without provenance (§6)
 *  - Unverified extractions cannot create publishable versions
 *  - Changed fields become first-class VersionChange objects (§12)
 */
import { q, q1, run, nextId, nowIso } from "./db";
import type { CandidateOffer, ExtractedField } from "./extractor";
import { EXTRACTOR_VERSION } from "./extractor";
import { diffMaterialFields, extractFieldsToRecord } from "./matching";
import { logAudit } from "./audit";

// ---------------------------------------------------------------------------
// Message state machine (§7)
// ---------------------------------------------------------------------------
export const MESSAGE_STATES = [
  "RECEIVED", "PROCESSING", "EXTRACTED", "NEEDS_REVIEW", "VERIFIED", "PUBLISHED",
  "NO_OFFER", "DUPLICATE", "LOW_CONFIDENCE", "POSSIBLE_UPDATE", "FAILED", "ARCHIVED",
] as const;
export type MessageState = (typeof MESSAGE_STATES)[number];

export function setMessageState(messageId: string, state: MessageState, actorId: string | null = null) {
  run(`UPDATE messages SET state = ? WHERE id = ?`, state, messageId);
  logAudit(actorId, "message.state_changed", "message", messageId, { state });
}

// ---------------------------------------------------------------------------
// Extraction persistence (§6 provenance envelope)
// ---------------------------------------------------------------------------
export function persistExtraction(messageId: string, candidates: CandidateOffer[]): string[] {
  const extractionIds: string[] = [];
  if (!candidates.length) {
    setMessageState(messageId, "NO_OFFER");
    return extractionIds;
  }
  let index = 0;
  for (const c of candidates) {
    const exId = nextId("extraction", "extractions");
    run(
      `INSERT INTO extractions
        (id, message_id, offer_index, extractor_version, is_offer, offer_type, headline, claim_original, source_language, status, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'da', 'candidate', ?)`,
      exId, messageId, index, EXTRACTOR_VERSION, c.offer_type, c.headline,
      c.headline ?? c.supporting_claim ?? "", nowIso()
    );
    for (const f of c.fields) {
      run(
        `INSERT OR IGNORE INTO extraction_fields
          (id, extraction_id, field, value_json, evidence_span, locator_start, locator_end, confidence, extractor_version, verification_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        nextId("efield", "extraction_fields"), exId, f.field, JSON.stringify(f.value),
        f.evidence_span, f.locator_start, f.locator_end, f.confidence, EXTRACTOR_VERSION
      );
    }
    extractionIds.push(exId);
    index++;
  }
  const lowConfidence = candidates.every((c) =>
    c.fields.every((f) => f.confidence < 0.7)
  );
  setMessageState(messageId, lowConfidence ? "LOW_CONFIDENCE" : "NEEDS_REVIEW");
  logAudit(null, "extraction.created", "message", messageId, {
    count: extractionIds.length, extractor: EXTRACTOR_VERSION,
  });
  return extractionIds;
}

// ---------------------------------------------------------------------------
// Human verification (§10)
// ---------------------------------------------------------------------------
export type FieldAction = "confirm" | "edit" | "unknown";

export function applyFieldAction(
  fieldId: string,
  action: FieldAction,
  reviewerId: string,
  humanValue?: unknown
): { ok: boolean; error?: string } {
  const f = q1<{
    id: string; extraction_id: string; field: string; value_json: string;
    evidence_span: string; confidence: number; extractor_version: string;
  }>(`SELECT * FROM extraction_fields WHERE id = ?`, fieldId);
  if (!f) return { ok: false, error: "field_not_found" };
  if (action === "edit" && humanValue === undefined) {
    return { ok: false, error: "edit_requires_value" };
  }

  const status = action === "confirm" ? "confirmed" : action === "edit" ? "edited" : "unknown";
  run(
    `UPDATE extraction_fields
        SET verification_status = ?, verified_by = ?, verified_at = ?
      WHERE id = ?`,
    status, reviewerId, nowIso(), fieldId
  );
  if (action === "edit") {
    run(`UPDATE extraction_fields SET value_json = ? WHERE id = ?`, JSON.stringify(humanValue), fieldId);
  }
  // Human correction retained as evaluation data (§10): AI prediction frozen
  run(
    `INSERT INTO human_corrections
      (id, extraction_field_id, ai_prediction_json, human_action, human_value_json, evidence_span, extractor_version, reviewer_id, corrected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    nextId("hcorr", "human_corrections"), fieldId,
    JSON.stringify({ value: JSON.parse(f.value_json), confidence: f.confidence }),
    action, action === "edit" ? JSON.stringify(humanValue) : null,
    f.evidence_span, f.extractor_version, reviewerId, nowIso()
  );
  const auditAction =
    action === "confirm" ? "extraction.field_confirmed"
    : action === "edit" ? "extraction.field_edited"
    : "extraction.field_unknown";
  logAudit(reviewerId, auditAction, "extraction_field", fieldId, { field: f.field });
  return { ok: true };
}

export function extractionFullyReviewed(extractionId: string): boolean {
  const row = q1<{ pending: number }>(
    `SELECT COUNT(*) AS pending FROM extraction_fields
      WHERE extraction_id = ? AND verification_status = 'pending'`,
    extractionId
  );
  return (row?.pending ?? 1) === 0;
}

export function verifiedFieldsOf(extractionId: string): Record<string, unknown> {
  const rows = q<{ field: string; value_json: string; verification_status: string }>(
    `SELECT field, value_json, verification_status FROM extraction_fields WHERE extraction_id = ?`,
    extractionId
  );
  const fields: Record<string, unknown> = {};
  for (const r of rows) {
    if (r.verification_status === "unknown") continue; // unknown ≠ fact (§6)
    fields[r.field] = JSON.parse(r.value_json);
  }
  return fields;
}

/** Mark extraction verified — requires all fields reviewed. */
export function verifyExtraction(extractionId: string, reviewerId: string): { ok: boolean; error?: string } {
  if (!extractionFullyReviewed(extractionId)) {
    return { ok: false, error: "fields_pending" };
  }
  run(`UPDATE extractions SET status = 'confirmed' WHERE id = ?`, extractionId);
  const ex = q1<{ message_id: string }>(`SELECT message_id FROM extractions WHERE id = ?`, extractionId);
  if (ex) setMessageState(ex.message_id, "VERIFIED", reviewerId);
  logAudit(reviewerId, "extraction.verified", "extraction", extractionId, {});
  return { ok: true };
}

export function markNotAnOffer(extractionId: string, reviewerId: string) {
  run(`UPDATE extractions SET status = 'not_an_offer', is_offer = 0 WHERE id = ?`, extractionId);
  const ex = q1<{ message_id: string }>(`SELECT message_id FROM extractions WHERE id = ?`, extractionId);
  const remaining = q1<{ n: number }>(
    `SELECT COUNT(*) AS n FROM extractions WHERE message_id = ? AND is_offer = 1 AND status != 'not_an_offer'`,
    ex?.message_id ?? ""
  );
  if (ex && (remaining?.n ?? 0) === 0) setMessageState(ex.message_id, "NO_OFFER", reviewerId);
  logAudit(reviewerId, "extraction.not_an_offer", "extraction", extractionId, {});
}

// ---------------------------------------------------------------------------
// Offer / Campaign / Version creation (§6 core model, §12 change detection)
// ---------------------------------------------------------------------------
export function commitVersion(opts: {
  extractionId: string;
  matchedOfferId: string | null; // null → create new offer
  reviewerId: string;
  canonicalIdentity: string;
  observedAt: string;
  workingName: string;
}): { ok: boolean; offerId?: string; versionId?: string; changedFields?: string[]; error?: string } {
  const ex = q1<{
    id: string; message_id: string; offer_type: string; headline: string | null;
    claim_original: string; source_language: string; status: string;
  }>(`SELECT * FROM extractions WHERE id = ?`, opts.extractionId);
  if (!ex) return { ok: false, error: "extraction_not_found" };
  if (ex.status !== "confirmed") return { ok: false, error: "extraction_not_verified" }; // §7: no accidental publish path

  const msg = q1<{ id: string; source_id: string; received_at: string }>(
    `SELECT * FROM messages WHERE id = ?`, ex.message_id
  );
  if (!msg) return { ok: false, error: "message_not_found" };
  const src = q1<{ company_id: string }>(`SELECT company_id FROM newsletter_sources WHERE id = ?`, msg.source_id);
  if (!src) return { ok: false, error: "source_not_found" };

  const fields = verifiedFieldsOf(ex.id);
  const allFieldRows = q<{
    field: string; value_json: string; evidence_span: string; locator_start: number;
    locator_end: number; confidence: number; verification_status: string;
  }>(`SELECT * FROM extraction_fields WHERE extraction_id = ?`, ex.id);

  let offerId = opts.matchedOfferId;
  let campaignId: string | null = null;
  let versionNo = 1;
  let predecessorId: string | null = null;
  let changedFields: string[] = [];

  if (offerId) {
    const offer = q1<{ campaign_id: string | null }>(
      `SELECT campaign_id FROM offers WHERE id = ?`, offerId
    );
    if (!offer) return { ok: false, error: "offer_not_found" };
    campaignId = offer.campaign_id;
    const prev = q1<{ id: string; version: number; fields_json: string }>(
      `SELECT id, version, fields_json FROM offer_versions
        WHERE offer_id = ? ORDER BY version DESC LIMIT 1`,
      offerId
    );
    if (prev) {
      versionNo = prev.version + 1;
      predecessorId = prev.id;
      changedFields = diffMaterialFields(fields, JSON.parse(prev.fields_json));
    }
    run(`UPDATE offers SET last_seen = ? WHERE id = ?`, opts.observedAt, offerId);
  } else {
    // New campaign (or reuse company's campaign by working name)
    const existingCampaign = q1<{ id: string }>(
      `SELECT id FROM campaigns WHERE company_id = ? AND working_name = ?`,
      src.company_id, opts.workingName
    );
    if (existingCampaign) {
      campaignId = existingCampaign.id;
      run(`UPDATE campaigns SET last_seen = ? WHERE id = ?`, opts.observedAt, campaignId);
    } else {
      campaignId = nextId("campaign", "campaigns");
      run(
        `INSERT INTO campaigns (id, company_id, working_name, first_seen, last_seen)
         VALUES (?, ?, ?, ?, ?)`,
        campaignId, src.company_id, opts.workingName, opts.observedAt, opts.observedAt
      );
    }
    offerId = nextId("offer", "offers");
    run(
      `INSERT INTO offers (id, company_id, campaign_id, offer_type, canonical_identity, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      offerId, src.company_id, campaignId, ex.offer_type ?? "other",
      opts.canonicalIdentity, opts.observedAt, opts.observedAt
    );
    logAudit(opts.reviewerId, "offer.created", "offer", offerId, { company_id: src.company_id });
  }

  const versionId = nextId("offer_version", "offer_versions");
  run(
    `INSERT INTO offer_versions
      (id, offer_id, version, message_id, claim_original, source_language, observed_at,
       fields_json, verification_status, publication_status, predecessor_version_id,
       changed_fields_json, verified_by, verified_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified', 'unpublished', ?, ?, ?, ?, ?)`,
    versionId, offerId, versionNo, msg.id, ex.claim_original, ex.source_language,
    opts.observedAt, JSON.stringify(fields), predecessorId,
    JSON.stringify(changedFields), opts.reviewerId, nowIso(), nowIso()
  );

  // Evidence rows (§6): one per verified field with evidence span
  let evNo = 0;
  for (const fr of allFieldRows) {
    if (fr.verification_status === "unknown") continue;
    evNo++;
    run(
      `INSERT INTO evidence
        (id, offer_version_id, field, evidence_span, source_message_id, evidence_ref, approved_for_public, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      nextId("evidence", "evidence"), versionId, fr.field, fr.evidence_span,
      msg.id, `EVIDENCE ${String(evNo).padStart(2, "0")}`, nowIso()
    );
  }

  // Change detection objects (§12)
  if (predecessorId && changedFields.length) {
    const prevFields = predecessorId
      ? JSON.parse(q1<{ fields_json: string }>(`SELECT fields_json FROM offer_versions WHERE id = ?`, predecessorId)!.fields_json)
      : {};
    for (const cf of changedFields) {
      run(
        `INSERT INTO version_changes
          (id, predecessor_version_id, successor_version_id, field, old_value_json, new_value_json, changed_at, evidence_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        nextId("vchange", "version_changes"), predecessorId, versionId, cf,
        JSON.stringify(prevFields[cf] ?? null), JSON.stringify(fields[cf] ?? null),
        opts.observedAt,
        q1<{ evidence_ref: string }>(
          `SELECT evidence_ref FROM evidence WHERE offer_version_id = ? AND field = ?`,
          versionId, cf
        )?.evidence_ref ?? null
      );
    }
  }

  setMessageState(msg.id, "VERIFIED", opts.reviewerId);
  logAudit(opts.reviewerId, "version.created", "offer_version", versionId, {
    offer_id: offerId, version: versionNo, changed_fields: changedFields,
  });
  return { ok: true, offerId, versionId, changedFields };
}

// ---------------------------------------------------------------------------
// Publication (§7): explicit transition, verified-only
// ---------------------------------------------------------------------------
export function publishVersion(versionId: string, actorId: string): { ok: boolean; error?: string } {
  const v = q1<{
    id: string; verification_status: string; publication_status: string;
    message_id: string; offer_id: string;
  }>(`SELECT * FROM offer_versions WHERE id = ?`, versionId);
  if (!v) return { ok: false, error: "not_found" };
  if (v.verification_status !== "verified") return { ok: false, error: "not_verified" }; // hard guard
  if (v.publication_status === "published") return { ok: false, error: "already_published" };

  run(
    `UPDATE offer_versions SET publication_status = 'published', published_at = ?, published_by = ? WHERE id = ?`,
    nowIso(), actorId, versionId
  );
  setMessageState(v.message_id, "PUBLISHED", actorId);
  logAudit(actorId, "version.published", "offer_version", versionId, { offer_id: v.offer_id });
  fanOutReviewTasks(versionId);
  return { ok: true };
}

/** After publication: every user who selected this newsletter gets a task (§9/§20 chain step 12). */
export function fanOutReviewTasks(versionId: string) {
  const v = q1<{ message_id: string }>(`SELECT message_id FROM offer_versions WHERE id = ?`, versionId);
  if (!v) return;
  const msg = q1<{ source_id: string }>(`SELECT source_id FROM messages WHERE id = ?`, v.message_id);
  if (!msg) return;
  const users = q<{ user_id: string }>(
    `SELECT user_id FROM user_newsletter_selections WHERE source_id = ?`, msg.source_id
  );
  for (const u of users) {
    run(
      `INSERT OR IGNORE INTO review_tasks (id, user_id, offer_version_id, status, created_at)
       VALUES (?, ?, ?, 'open', ?)`,
      nextId("task", "review_tasks"), u.user_id, versionId, nowIso()
    );
  }
}
