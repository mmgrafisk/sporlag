/**
 * PUBLIC PROJECTION + READ QUERIES (§21 BUILD SPEC)
 * Everything here that touches public pages reads ONLY:
 *   - published offer versions
 *   - approved structured facts
 *   - approved evidence excerpts (never raw bodies)
 *   - aggregated community observations
 * Internal message bodies are NEVER exposed through consumer-facing queries.
 */
import { q, q1 } from "./db";
import { communitySummary, companyClarity, type CommunitySummary, type CompanyClarity } from "./aggregation";

// ---------------------------------------------------------------------------
// Public: offers
// ---------------------------------------------------------------------------
export type PublicOfferRow = {
  offer_id: string;
  company_id: string;
  company_name: string;
  company_slug: string;
  category: string | null;
  offer_type: string;
  version: number;
  version_id: string;
  claim_original: string;
  fields_json: string;
  observed_at: string;
  changed_fields_json: string;
  total_versions: number;
  recognition_status: string | null;
  recognition_verified: number | null;
};

export function listPublishedOffers(opts: {
  companySlug?: string;
  offerType?: string;
  changedOnly?: boolean;
  limit?: number;
} = {}): PublicOfferRow[] {
  const where = [`ov.publication_status = 'published'`];
  const params: (string | number)[] = [];
  // only the newest published version per offer
  where.push(`ov.id = (SELECT ov2.id FROM offer_versions ov2
                        WHERE ov2.offer_id = o.id AND ov2.publication_status = 'published'
                        ORDER BY ov2.version DESC LIMIT 1)`);
  if (opts.companySlug) { where.push(`c.slug = ?`); params.push(opts.companySlug); }
  if (opts.offerType) { where.push(`o.offer_type = ?`); params.push(opts.offerType); }
  if (opts.changedOnly) { where.push(`ov.version > 1`) }
  const sql = `
    SELECT o.id AS offer_id, c.id AS company_id, c.name AS company_name, c.slug AS company_slug,
           c.category, o.offer_type, ov.version, ov.id AS version_id, ov.claim_original,
           ov.fields_json, ov.observed_at, ov.changed_fields_json,
           (SELECT COUNT(*) FROM offer_versions WHERE offer_id = o.id AND publication_status='published') AS total_versions,
           r.status AS recognition_status,
           CASE WHEN r.verified_by IS NOT NULL THEN 1 ELSE 0 END AS recognition_verified
      FROM offer_versions ov
      JOIN offers o ON o.id = ov.offer_id
      JOIN companies c ON c.id = o.company_id
      LEFT JOIN recognitions r ON r.offer_version_id = ov.id
     WHERE ${where.join(" AND ")}
     ORDER BY ov.observed_at DESC
     ${opts.limit ? `LIMIT ${Number(opts.limit)}` : ""}`;
  return q<PublicOfferRow>(sql, ...params);
}

export function getPublishedOffer(offerId: string) {
  const offer = q1<{
    offer_id: string; company_id: string; company_name: string; company_slug: string;
    category: string | null; offer_type: string; campaign_name: string | null;
    first_seen: string; last_seen: string;
  }>(
    `SELECT o.id AS offer_id, c.id AS company_id, c.name AS company_name, c.slug AS company_slug,
            c.category, o.offer_type, ca.working_name AS campaign_name, o.first_seen, o.last_seen
       FROM offers o
       JOIN companies c ON c.id = o.company_id
       LEFT JOIN campaigns ca ON ca.id = o.campaign_id
      WHERE o.id = ?`, offerId
  );
  if (!offer) return null;
  const versions = q<{
    id: string; version: number; claim_original: string; source_language: string;
    observed_at: string; fields_json: string; changed_fields_json: string;
    verification_status: string; publication_status: string; published_at: string | null;
    predecessor_version_id: string | null; verified_at: string | null;
  }>(
    `SELECT * FROM offer_versions WHERE offer_id = ? ORDER BY version ASC`, offerId
  );
  const published = versions.filter((v) => v.publication_status === "published");
  if (!published.length) return null;
  const latest = published[published.length - 1];

  const evidence = q<{ id: string; field: string; evidence_span: string; evidence_ref: string }>(
    `SELECT * FROM evidence WHERE offer_version_id = ? AND approved_for_public = 1 ORDER BY evidence_ref`,
    latest.id
  );
  const changes = q<{
    id: string; field: string; old_value_json: string; new_value_json: string;
    changed_at: string; evidence_ref: string | null; successor_version_id: string;
  }>(
    `SELECT vc.* FROM version_changes vc
       JOIN offer_versions ov ON ov.id = vc.successor_version_id
      WHERE ov.offer_id = ?
      ORDER BY vc.changed_at ASC`, offerId
  );
  const recognition = q1<{
    id: string; status: string; method_version: string; dimensions_json: string;
    evidence_refs_json: string; sample_size: number; verified_by: string | null;
    verified_at: string | null; decided_at: string;
  }>(`SELECT * FROM recognitions WHERE offer_version_id = ?`, latest.id);

  const summary: CommunitySummary = communitySummary(latest.id);

  return {
    ...offer,
    versions,
    publishedVersions: published,
    latest,
    evidence,
    changes,
    recognition,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Public: companies (§14)
// ---------------------------------------------------------------------------
export type CompanyListRow = {
  id: string; name: string; slug: string; category: string | null;
  published_offers: number; last_observed: string | null;
};

export function listCompanies(): CompanyListRow[] {
  return q<CompanyListRow>(
    `SELECT c.id, c.name, c.slug, c.category,
            (SELECT COUNT(DISTINCT o.id) FROM offers o
              JOIN offer_versions ov ON ov.offer_id = o.id
              WHERE o.company_id = c.id AND ov.publication_status = 'published') AS published_offers,
            (SELECT MAX(ov.observed_at) FROM offers o
              JOIN offer_versions ov ON ov.offer_id = o.id
              WHERE o.company_id = c.id AND ov.publication_status = 'published') AS last_observed
       FROM companies c
      WHERE c.status = 'active'
      ORDER BY c.name COLLATE NOCASE`
  );
}

export function getCompanyProfile(slug: string) {
  const company = q1<{ id: string; name: string; slug: string; market: string; category: string | null }>(
    `SELECT * FROM companies WHERE slug = ? AND status = 'active'`, slug
  );
  if (!company) return null;
  const sources = q<{ id: string; name: string; alias_email: string; language: string; status: string }>(
    `SELECT * FROM newsletter_sources WHERE company_id = ? ORDER BY created_at`, company.id
  );
  const clarity: CompanyClarity[] = companyClarity(company.id);
  const offers = listPublishedOffers({ companySlug: slug });
  const stats = q1<{ offers: number; versions: number; observations: number }>(
    `SELECT
       (SELECT COUNT(*) FROM offers WHERE company_id = ?) AS offers,
       (SELECT COUNT(*) FROM offer_versions ov JOIN offers o ON o.id = ov.offer_id
         WHERE o.company_id = ? AND ov.publication_status = 'published') AS versions,
       (SELECT COUNT(*) FROM community_observations co
         JOIN offer_versions ov ON ov.id = co.offer_version_id
         JOIN offers o ON o.id = ov.offer_id
         WHERE o.company_id = ? AND ov.publication_status = 'published') AS observations`,
    company.id, company.id, company.id
  );
  const changes = q<{
    field: string; old_value_json: string; new_value_json: string; changed_at: string;
    offer_id: string; claim_original: string; version: number;
  }>(
    `SELECT vc.field, vc.old_value_json, vc.new_value_json, vc.changed_at,
            o.id AS offer_id, ov.claim_original, ov.version
       FROM version_changes vc
       JOIN offer_versions ov ON ov.id = vc.successor_version_id
       JOIN offers o ON o.id = ov.offer_id
      WHERE o.company_id = ? AND ov.publication_status = 'published'
      ORDER BY vc.changed_at DESC LIMIT 8`,
    company.id
  );
  return { ...company, sources, clarity, offers, stats: stats ?? { offers: 0, versions: 0, observations: 0 }, changes };
}

// ---------------------------------------------------------------------------
// Public: changes across the market (home "Ændret siden sidst")
// ---------------------------------------------------------------------------
export function recentPublishedChanges(limit = 6) {
  return q<{
    id: string; field: string; old_value_json: string; new_value_json: string; changed_at: string;
    offer_id: string; company_name: string; company_slug: string; claim_original: string; version: number;
  }>(
    `SELECT vc.id, vc.field, vc.old_value_json, vc.new_value_json, vc.changed_at,
            o.id AS offer_id, c.name AS company_name, c.slug AS company_slug,
            ov.claim_original, ov.version
       FROM version_changes vc
       JOIN offer_versions ov ON ov.id = vc.successor_version_id
       JOIN offers o ON o.id = ov.offer_id
       JOIN companies c ON c.id = o.company_id
      WHERE ov.publication_status = 'published'
      ORDER BY vc.changed_at DESC
      LIMIT ?`, limit
  );
}

// ---------------------------------------------------------------------------
// Consumer: newsletters, queue, profile
// ---------------------------------------------------------------------------
export function userSelections(userId: string) {
  return q<{
    source_id: string; source_name: string; company_name: string; company_slug: string;
    selected_at: string; open_tasks: number; last_observed: string | null; last_change: string | null;
  }>(
    `SELECT s.id AS source_id, s.name AS source_name, c.name AS company_name, c.slug AS company_slug,
            uns.selected_at,
            (SELECT COUNT(*) FROM review_tasks rt
              JOIN offer_versions ov ON ov.id = rt.offer_version_id
              JOIN messages m ON m.id = ov.message_id
              WHERE rt.user_id = ? AND rt.status = 'open' AND m.source_id = s.id) AS open_tasks,
            (SELECT MAX(ov.observed_at) FROM offer_versions ov
              JOIN messages m ON m.id = ov.message_id
              WHERE m.source_id = s.id AND ov.publication_status = 'published') AS last_observed,
            (SELECT MAX(vc.changed_at) FROM version_changes vc
              JOIN offer_versions ov ON ov.id = vc.successor_version_id
              JOIN messages m ON m.id = ov.message_id
              WHERE m.source_id = s.id AND ov.publication_status = 'published') AS last_change
       FROM user_newsletter_selections uns
       JOIN newsletter_sources s ON s.id = uns.source_id
       JOIN companies c ON c.id = s.company_id
      WHERE uns.user_id = ?
      ORDER BY c.name COLLATE NOCASE`,
    userId, userId
  );
}

export function reviewQueue(userId: string) {
  return q<{
    task_id: string; offer_version_id: string; offer_id: string; version: number;
    claim_original: string; company_name: string; company_slug: string;
    observed_at: string; fields_json: string; offer_type: string;
  }>(
    `SELECT rt.id AS task_id, ov.id AS offer_version_id, o.id AS offer_id, ov.version,
            ov.claim_original, c.name AS company_name, c.slug AS company_slug,
            ov.observed_at, ov.fields_json, o.offer_type
       FROM review_tasks rt
       JOIN offer_versions ov ON ov.id = rt.offer_version_id
       JOIN offers o ON o.id = ov.offer_id
       JOIN companies c ON c.id = o.company_id
      WHERE rt.user_id = ? AND rt.status = 'open' AND ov.publication_status = 'published'
      ORDER BY rt.created_at DESC`,
    userId
  );
}

export function reviewTaskById(taskId: string, userId: string) {
  return q1<{
    task_id: string; offer_version_id: string; offer_id: string; version: number;
    claim_original: string; company_name: string; company_slug: string;
    observed_at: string; fields_json: string; offer_type: string; status: string;
  }>(
    `SELECT rt.id AS task_id, rt.status, ov.id AS offer_version_id, o.id AS offer_id, ov.version,
            ov.claim_original, c.name AS company_name, c.slug AS company_slug,
            ov.observed_at, ov.fields_json, o.offer_type
       FROM review_tasks rt
       JOIN offer_versions ov ON ov.id = rt.offer_version_id
       JOIN offers o ON o.id = ov.offer_id
       JOIN companies c ON c.id = o.company_id
      WHERE rt.id = ? AND rt.user_id = ?`,
    taskId, userId
  );
}

export function contributionProfile(userId: string) {
  return q1<{ contribution_points: number; reputation: number; impact_count: number }>(
    `SELECT * FROM contributor_profiles WHERE user_id = ?`, userId
  ) ?? { contribution_points: 0, reputation: 50, impact_count: 0 };
}

export function userObservationCount(userId: string): number {
  return q1<{ n: number }>(
    `SELECT COUNT(DISTINCT offer_version_id) AS n FROM community_observations WHERE user_id = ?`, userId
  )?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Internal: studio / admin (role-protected routes only)
// ---------------------------------------------------------------------------
export function listMessages(opts: { state?: string; limit?: number } = {}) {
  const params: (string | number)[] = [];
  let where = "1=1";
  if (opts.state) { where = "m.state = ?"; params.push(opts.state); }
  return q<{
    id: string; subject_private: string; state: string; received_at: string;
    source_name: string; company_name: string; company_slug: string;
    candidate_count: number;
  }>(
    `SELECT m.id, m.subject_private, m.state, m.received_at, s.name AS source_name,
            c.name AS company_name, c.slug AS company_slug,
            (SELECT COUNT(*) FROM extractions e WHERE e.message_id = m.id AND e.is_offer = 1 AND e.status != 'not_an_offer') AS candidate_count
       FROM messages m
       JOIN newsletter_sources s ON s.id = m.source_id
       JOIN companies c ON c.id = s.company_id
      WHERE ${where}
      ORDER BY m.received_at DESC
      ${opts.limit ? `LIMIT ${Number(opts.limit)}` : ""}`,
    ...params
  );
}

export function getMessagePrivate(messageId: string) {
  return q1<{
    id: string; source_id: string; received_at: string; subject_private: string;
    body_raw_private: string; body_normalized_private: string; links_json: string;
    state: string; content_fingerprint: string; source_name: string; company_name: string;
  }>(
    `SELECT m.*, s.name AS source_name, c.name AS company_name
       FROM messages m
       JOIN newsletter_sources s ON s.id = m.source_id
       JOIN companies c ON c.id = s.company_id
      WHERE m.id = ?`, messageId
  );
}

export function getExtractionsForMessage(messageId: string) {
  return q<{
    id: string; offer_index: number; extractor_version: string; offer_type: string | null;
    headline: string | null; claim_original: string; status: string; is_offer: number;
  }>(
    `SELECT * FROM extractions WHERE message_id = ? ORDER BY offer_index`, messageId
  );
}

export function getExtractionFields(extractionId: string) {
  return q<{
    id: string; field: string; value_json: string; evidence_span: string;
    locator_start: number; locator_end: number; confidence: number;
    extractor_version: string; verification_status: string;
    verified_by: string | null; verified_at: string | null;
  }>(
    `SELECT * FROM extraction_fields WHERE extraction_id = ? ORDER BY locator_start`, extractionId
  );
}

export function getMatchCandidates(extractionId: string) {
  return q<{
    id: string; candidate_offer_id: string; confidence: number; reason_codes_json: string;
    changed_fields_json: string; reviewer_decision: string | null; claim_original: string | null;
    version: number | null;
  }>(
    `SELECT mc.*, o.canonical_identity, ov.claim_original, ov.version
       FROM match_candidates mc
       JOIN offers o ON o.id = mc.candidate_offer_id
       LEFT JOIN offer_versions ov ON ov.offer_id = o.id AND ov.version =
         (SELECT MAX(version) FROM offer_versions WHERE offer_id = o.id)
      WHERE mc.extraction_id = ?
      ORDER BY mc.confidence DESC`, extractionId
  );
}

export function versionsReadyForPublication() {
  return q<{
    id: string; version: number; claim_original: string; observed_at: string;
    offer_id: string; company_name: string; company_slug: string; changed_fields_json: string;
  }>(
    `SELECT ov.id, ov.version, ov.claim_original, ov.observed_at, ov.changed_fields_json,
            o.id AS offer_id, c.name AS company_name, c.slug AS company_slug
       FROM offer_versions ov
       JOIN offers o ON o.id = ov.offer_id
       JOIN companies c ON c.id = o.company_id
      WHERE ov.verification_status = 'verified' AND ov.publication_status = 'unpublished'
      ORDER BY ov.observed_at DESC`
  );
}

export function recognitionCandidates() {
  return q<{
    id: string; offer_version_id: string; status: string; method_version: string;
    dimensions_json: string; sample_size: number; verified_by: string | null; decided_at: string;
    claim_original: string; company_name: string; company_slug: string; offer_id: string; version: number;
  }>(
    `SELECT r.*, ov.claim_original, ov.offer_id, ov.version, c.name AS company_name, c.slug AS company_slug
       FROM recognitions r
       JOIN offer_versions ov ON ov.id = r.offer_version_id
       JOIN offers o ON o.id = ov.offer_id
       JOIN companies c ON c.id = o.company_id
      WHERE ov.publication_status = 'published'
      ORDER BY r.decided_at DESC`
  );
}

export function companySuggestions(status = "pending") {
  return q<{
    id: string; company_name: string; note: string | null; status: string;
    created_at: string; user_name: string | null; matched_company_id: string | null;
  }>(
    `SELECT cs.*, u.name AS user_name
       FROM company_suggestions cs
       LEFT JOIN users u ON u.id = cs.user_id
      WHERE cs.status = ?
      ORDER BY cs.created_at DESC`, status
  );
}

export function auditTrail(limit = 200) {
  return q<{
    id: string; action: string; entity_type: string; entity_id: string;
    detail_json: string; created_at: string; actor_name: string | null;
  }>(
    `SELECT a.*, u.name AS actor_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
      ORDER BY a.created_at DESC LIMIT ?`, limit
  );
}

export function sourceRegistry() {
  return q<{
    id: string; name: string; alias_email: string; language: string; status: string;
    source_confidence: string; subscription_type: string; company_name: string; company_slug: string;
    company_id: string; message_count: number;
  }>(
    `SELECT s.*, c.name AS company_name, c.slug AS company_slug, c.id AS company_id,
            (SELECT COUNT(*) FROM messages m WHERE m.source_id = s.id) AS message_count
       FROM newsletter_sources s
       JOIN companies c ON c.id = s.company_id
      ORDER BY c.name COLLATE NOCASE`
  );
}

export function pulseIssues() {
  return q<{
    id: string; period: string; title: string; standfirst: string; blocks_json: string;
    methodology: string; sample_size: number; published_at: string | null;
  }>(`SELECT * FROM pulse_issues ORDER BY period DESC`);
}

export function platformStats() {
  return q1<{
    published_versions: number; published_offers: number; changes: number; observations: number; companies: number;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM offer_versions WHERE publication_status='published') AS published_versions,
      (SELECT COUNT(DISTINCT offer_id) FROM offer_versions WHERE publication_status='published') AS published_offers,
      (SELECT COUNT(*) FROM version_changes vc JOIN offer_versions ov ON ov.id = vc.successor_version_id WHERE ov.publication_status='published') AS changes,
      (SELECT COUNT(*) FROM community_observations co JOIN offer_versions ov ON ov.id = co.offer_version_id WHERE ov.publication_status='published') AS observations,
      (SELECT COUNT(*) FROM companies WHERE status='active') AS companies`
  ) ?? { published_versions: 0, published_offers: 0, changes: 0, observations: 0, companies: 0 };
}
