/**
 * PUBLIC PROJECTION + READ QUERIES (§21 BUILD SPEC)
 * Everything here that touches public pages reads ONLY:
 *   - published offer versions
 *   - approved structured facts
 *   - approved evidence excerpts (never raw bodies)
 *   - aggregated community observations
 * Internal message bodies are NEVER exposed through consumer-facing queries.
 *
 * Hot paths are written as single-pass JOINs (no correlated per-row subqueries)
 * and memoized per request via React cache().
 */
import { cache } from "react";
import { q, q1, parseJson } from "./db";
import { communitySummary, companyClarity, type CommunitySummary, type CompanyClarity } from "./aggregation";

// ---------------------------------------------------------------------------
// Public: offers
// ---------------------------------------------------------------------------
export type PublicOfferRow = {
  offer_id: string;
  company_id: string;
  company_name: string;
  company_slug: string;
  company_logo_path: string | null;
  category: string | null;
  offer_type: string;
  version: number;
  version_id: string;
  claim_original: string;
  fields_json: string;
  fields: Record<string, unknown>;
  observed_at: string;
  changed_fields_json: string;
  changed_fields: string[];
  total_versions: number;
  recognition_status: string | null;
  recognition_verified: number | null;
  observation_users: number;
};

type PublicOfferSqlRow = Omit<PublicOfferRow, "fields" | "changed_fields">;

function hydrateOffer(row: PublicOfferSqlRow): PublicOfferRow {
  return {
    ...row,
    fields: parseJson<Record<string, unknown>>(row.fields_json, {}),
    changed_fields: parseJson<string[]>(row.changed_fields_json, []),
  };
}

function listPublishedOffersUncached(opts: {
  companySlug?: string;
  offerType?: string;
  changedOnly?: boolean;
  limit?: number;
  q?: string;
} = {}): PublicOfferRow[] {
  const where = [`ov.publication_status = 'published'`];
  const params: (string | number)[] = [];
  if (opts.companySlug) { where.push(`c.slug = ?`); params.push(opts.companySlug); }
  if (opts.offerType) { where.push(`o.offer_type = ?`); params.push(opts.offerType); }
  if (opts.changedOnly) { where.push(`ov.version > 1`); }
  if (opts.q) {
    const like = `%${opts.q.trim()}%`;
    where.push(`(ov.claim_original LIKE ? OR c.name LIKE ? OR IFNULL(c.category,'') LIKE ?)`);
    params.push(like, like, like);
  }
  const limit = opts.limit ? Number(opts.limit) : 0;
  if (limit) params.push(limit);

  // One grouped subquery finds the latest published version AND the version
  // count per offer — replaces the correlated "latest id" + COUNT(*) subqueries.
  const sql = `
    SELECT o.id AS offer_id, c.id AS company_id, c.name AS company_name, c.slug AS company_slug,
           c.logo_path AS company_logo_path,
           c.category, o.offer_type, ov.version, ov.id AS version_id, ov.claim_original,
           ov.fields_json, ov.observed_at, ov.changed_fields_json,
           latest.total_versions,
           r.status AS recognition_status,
           CASE WHEN r.verified_by IS NOT NULL THEN 1 ELSE 0 END AS recognition_verified,
           COALESCE(obs.users, 0) AS observation_users
      FROM offer_versions ov
      JOIN (
        SELECT offer_id, MAX(version) AS max_version, COUNT(*) AS total_versions
          FROM offer_versions
         WHERE publication_status = 'published'
         GROUP BY offer_id
      ) latest ON latest.offer_id = ov.offer_id AND latest.max_version = ov.version
      JOIN offers o ON o.id = ov.offer_id
      JOIN companies c ON c.id = o.company_id
      LEFT JOIN recognitions r ON r.offer_version_id = ov.id
      LEFT JOIN (
        SELECT offer_version_id, COUNT(DISTINCT user_id) AS users
          FROM community_observations
         GROUP BY offer_version_id
      ) obs ON obs.offer_version_id = ov.id
     WHERE ${where.join(" AND ")}
     ORDER BY ov.observed_at DESC
     ${limit ? "LIMIT ?" : ""}`;
  return q<PublicOfferSqlRow>(sql, ...params).map(hydrateOffer);
}

/** Per-request memoization with primitive args (object literals would miss the cache). */
export function listPublishedOffers(opts: {
  companySlug?: string;
  offerType?: string;
  changedOnly?: boolean;
  limit?: number;
  q?: string;
} = {}): PublicOfferRow[] {
  return listPublishedOffersCached(
    opts.companySlug ?? "",
    opts.offerType ?? "",
    opts.changedOnly ? 1 : 0,
    opts.limit ?? 0,
    opts.q ?? ""
  );
}

const listPublishedOffersCached = cache(
  (companySlug: string, offerType: string, changedOnly: number, limit: number, q: string) =>
    listPublishedOffersUncached({
      companySlug: companySlug || undefined,
      offerType: offerType || undefined,
      changedOnly: changedOnly === 1,
      limit: limit || undefined,
      q: q || undefined,
    })
);

export type PublicVersion = {
  id: string; version: number; claim_original: string; source_language: string;
  observed_at: string; fields_json: string; fields: Record<string, unknown>;
  changed_fields_json: string; changed_fields: string[];
  verification_status: string; publication_status: string; published_at: string | null;
  predecessor_version_id: string | null; verified_at: string | null;
};

export type PublicChange = {
  id: string; field: string; old_value_json: string; new_value_json: string;
  old_value: unknown; new_value: unknown;
  changed_at: string; evidence_ref: string | null; successor_version_id: string;
};

export type PublicRecognition = {
  id: string; status: string; method_version: string; dimensions_json: string;
  dimensions: { key: string; assessment: string; rationale: string }[];
  evidence_refs_json: string; sample_size: number; verified_by: string | null;
  verified_at: string | null; decided_at: string;
};

export const getPublishedOffer = cache(function getPublishedOffer(offerId: string) {
  const offer = q1<{
    offer_id: string; company_id: string; company_name: string; company_slug: string;
    company_logo_path: string | null;
    category: string | null; offer_type: string; campaign_name: string | null;
    first_seen: string; last_seen: string;
  }>(
    `SELECT o.id AS offer_id, c.id AS company_id, c.name AS company_name, c.slug AS company_slug,
            c.logo_path AS company_logo_path,
            c.category, o.offer_type, ca.working_name AS campaign_name, o.first_seen, o.last_seen
       FROM offers o
       JOIN companies c ON c.id = o.company_id
       LEFT JOIN campaigns ca ON ca.id = o.campaign_id
      WHERE o.id = ?`, offerId
  );
  if (!offer) return null;

  // Public projection: published versions only. Unpublished never leave this layer.
  const versionRows = q<{
    id: string; version: number; claim_original: string; source_language: string;
    observed_at: string; fields_json: string; changed_fields_json: string;
    verification_status: string; publication_status: string; published_at: string | null;
    predecessor_version_id: string | null; verified_at: string | null;
  }>(
    `SELECT id, version, claim_original, source_language, observed_at, fields_json,
            changed_fields_json, verification_status, publication_status, published_at,
            predecessor_version_id, verified_at
       FROM offer_versions
      WHERE offer_id = ? AND publication_status = 'published'
      ORDER BY version ASC`, offerId
  );
  if (!versionRows.length) return null;

  const published: PublicVersion[] = versionRows.map((v) => ({
    ...v,
    fields: parseJson<Record<string, unknown>>(v.fields_json, {}),
    changed_fields: parseJson<string[]>(v.changed_fields_json, []),
  }));
  const latest = published[published.length - 1];

  const evidence = q<{ id: string; field: string; evidence_span: string; evidence_ref: string }>(
    `SELECT id, field, evidence_span, evidence_ref FROM evidence
      WHERE offer_version_id = ? AND approved_for_public = 1 ORDER BY evidence_ref`,
    latest.id
  );
  const changeRows = q<{
    id: string; field: string; old_value_json: string; new_value_json: string;
    changed_at: string; evidence_ref: string | null; successor_version_id: string;
  }>(
    `SELECT vc.id, vc.field, vc.old_value_json, vc.new_value_json, vc.changed_at,
            vc.evidence_ref, vc.successor_version_id
       FROM version_changes vc
       JOIN offer_versions ov ON ov.id = vc.successor_version_id
      WHERE ov.offer_id = ? AND ov.publication_status = 'published'
      ORDER BY vc.changed_at ASC`, offerId
  );
  const changes: PublicChange[] = changeRows.map((c) => ({
    ...c,
    old_value: parseJson(c.old_value_json, null),
    new_value: parseJson(c.new_value_json, null),
  }));
  const recRow = q1<{
    id: string; status: string; method_version: string; dimensions_json: string;
    evidence_refs_json: string; sample_size: number; verified_by: string | null;
    verified_at: string | null; decided_at: string;
  }>(`SELECT * FROM recognitions WHERE offer_version_id = ?`, latest.id);
  const recognition: PublicRecognition | null = recRow
    ? {
        ...recRow,
        dimensions: parseJson(recRow.dimensions_json, []),
      }
    : null;

  const summary: CommunitySummary = communitySummary(latest.id);

  return {
    ...offer,
    publishedVersions: published,
    latest,
    evidence,
    changes,
    recognition,
    summary,
  };
});

// ---------------------------------------------------------------------------
// Public: companies (§14)
// ---------------------------------------------------------------------------
export type CompanyListRow = {
  id: string; name: string; slug: string; category: string | null;
  logo_path: string | null; website: string | null;
  published_offers: number; last_observed: string | null;
};

export const listCompanies = cache(function listCompanies(): CompanyListRow[] {
  return q<CompanyListRow>(
    `SELECT c.id, c.name, c.slug, c.category, c.logo_path, c.website,
            COUNT(DISTINCT CASE WHEN ov.publication_status = 'published' THEN o.id END) AS published_offers,
            MAX(CASE WHEN ov.publication_status = 'published' THEN ov.observed_at END) AS last_observed
       FROM companies c
       LEFT JOIN offers o ON o.company_id = c.id
       LEFT JOIN offer_versions ov ON ov.offer_id = o.id
      WHERE c.status = 'active'
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE`
  );
});

export const getCompanyProfile = cache(function getCompanyProfile(slug: string) {
  const company = q1<{
    id: string; name: string; slug: string; market: string; category: string | null;
    website: string | null; logo_path: string | null;
  }>(
    `SELECT id, name, slug, market, category, website, logo_path FROM companies WHERE slug = ? AND status = 'active'`, slug
  );
  if (!company) return null;
  const sources = q<{ id: string; name: string; language: string; status: string }>(
    `SELECT id, name, language, status FROM newsletter_sources WHERE company_id = ? ORDER BY created_at`, company.id
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
  const changeRows = q<{
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
  const changes = changeRows.map((c) => ({
    ...c,
    old_value: parseJson(c.old_value_json, null),
    new_value: parseJson(c.new_value_json, null),
  }));
  return { ...company, sources, clarity, offers, stats: stats ?? { offers: 0, versions: 0, observations: 0 }, changes };
});

export function isSourceSelected(userId: string, sourceId: string): boolean {
  return !!q1(
    `SELECT 1 AS n FROM user_newsletter_selections WHERE user_id = ? AND source_id = ?`,
    userId, sourceId
  );
}

// ---------------------------------------------------------------------------
// Public: changes across the market (home "Ændret siden sidst")
// ---------------------------------------------------------------------------
export const recentPublishedChanges = cache(function recentPublishedChanges(limit = 6) {
  const rows = q<{
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
  return rows.map((c) => ({
    ...c,
    old_value: parseJson(c.old_value_json, null),
    new_value: parseJson(c.new_value_json, null),
  }));
});

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
            COALESCE(tasks.open_tasks, 0) AS open_tasks,
            last_obs.last_observed,
            last_chg.last_change
       FROM user_newsletter_selections uns
       JOIN newsletter_sources s ON s.id = uns.source_id
       JOIN companies c ON c.id = s.company_id
       LEFT JOIN (
         SELECT m.source_id, COUNT(*) AS open_tasks
           FROM review_tasks rt
           JOIN offer_versions ov ON ov.id = rt.offer_version_id
           JOIN messages m ON m.id = ov.message_id
          WHERE rt.user_id = ? AND rt.status = 'open'
          GROUP BY m.source_id
       ) tasks ON tasks.source_id = s.id
       LEFT JOIN (
         SELECT m.source_id, MAX(ov.observed_at) AS last_observed
           FROM offer_versions ov
           JOIN messages m ON m.id = ov.message_id
          WHERE ov.publication_status = 'published'
          GROUP BY m.source_id
       ) last_obs ON last_obs.source_id = s.id
       LEFT JOIN (
         SELECT m.source_id, MAX(vc.changed_at) AS last_change
           FROM version_changes vc
           JOIN offer_versions ov ON ov.id = vc.successor_version_id
           JOIN messages m ON m.id = ov.message_id
          WHERE ov.publication_status = 'published'
          GROUP BY m.source_id
       ) last_chg ON last_chg.source_id = s.id
      WHERE uns.user_id = ?
      ORDER BY c.name COLLATE NOCASE`,
    userId, userId
  );
}

export function listAvailableSources() {
  return q<{
    source_id: string; source_name: string; company_name: string; company_slug: string; published_offers: number;
  }>(
    `SELECT s.id AS source_id, s.name AS source_name, c.name AS company_name, c.slug AS company_slug,
            COUNT(DISTINCT CASE WHEN ov.publication_status = 'published' THEN o.id END) AS published_offers
       FROM newsletter_sources s
       JOIN companies c ON c.id = s.company_id
       LEFT JOIN offers o ON o.company_id = c.id
       LEFT JOIN offer_versions ov ON ov.offer_id = o.id
      WHERE s.status = 'active'
      GROUP BY s.id
      ORDER BY c.name COLLATE NOCASE`
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
    `SELECT contribution_points, reputation, impact_count FROM contributor_profiles WHERE user_id = ?`, userId
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
  const limit = opts.limit ? Number(opts.limit) : 0;
  if (limit) params.push(limit);
  return q<{
    id: string; subject_private: string; state: string; received_at: string;
    source_name: string; company_name: string; company_slug: string;
    candidate_count: number;
  }>(
    `SELECT m.id, m.subject_private, m.state, m.received_at, s.name AS source_name,
            c.name AS company_name, c.slug AS company_slug,
            COALESCE(ex.candidate_count, 0) AS candidate_count
       FROM messages m
       JOIN newsletter_sources s ON s.id = m.source_id
       JOIN companies c ON c.id = s.company_id
       LEFT JOIN (
         SELECT message_id, COUNT(*) AS candidate_count
           FROM extractions
          WHERE is_offer = 1 AND status != 'not_an_offer'
          GROUP BY message_id
       ) ex ON ex.message_id = m.id
      WHERE ${where}
      ORDER BY m.received_at DESC
      ${limit ? "LIMIT ?" : ""}`,
    ...params
  );
}

export function getMessagePrivate(messageId: string) {
  return q1<{
    id: string; source_id: string; received_at: string; subject_private: string;
    body_raw_private: string; body_normalized_private: string; links_json: string;
    state: string; content_fingerprint: string; source_name: string; company_name: string;
  }>(
    `SELECT m.id, m.source_id, m.received_at, m.subject_private, m.body_raw_private,
            m.body_normalized_private, m.links_json, m.state, m.content_fingerprint,
            s.name AS source_name, c.name AS company_name
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
    `SELECT id, offer_index, extractor_version, offer_type, headline, claim_original, status, is_offer
       FROM extractions WHERE message_id = ? ORDER BY offer_index`, messageId
  );
}

export function getExtractionFields(extractionId: string) {
  return q<{
    id: string; field: string; value_json: string; evidence_span: string;
    locator_start: number; locator_end: number; confidence: number;
    extractor_version: string; verification_status: string;
    verified_by: string | null; verified_at: string | null;
  }>(
    `SELECT id, field, value_json, evidence_span, locator_start, locator_end, confidence,
            extractor_version, verification_status, verified_by, verified_at
       FROM extraction_fields WHERE extraction_id = ? ORDER BY locator_start`, extractionId
  );
}

export function getMatchCandidates(extractionId: string) {
  return q<{
    id: string; candidate_offer_id: string; confidence: number; reason_codes_json: string;
    changed_fields_json: string; reviewer_decision: string | null; claim_original: string | null;
    version: number | null;
  }>(
    `SELECT mc.id, mc.candidate_offer_id, mc.confidence, mc.reason_codes_json, mc.changed_fields_json,
            mc.reviewer_decision, ov.claim_original, ov.version
       FROM match_candidates mc
       JOIN offers o ON o.id = mc.candidate_offer_id
       LEFT JOIN offer_versions ov ON ov.offer_id = o.id AND ov.version =
         (SELECT MAX(version) FROM offer_versions WHERE offer_id = o.id)
      WHERE mc.extraction_id = ?
      ORDER BY mc.confidence DESC`, extractionId
  );
}

/** Studio payload: one message → extractions + fields + matches in 3 queries, not 1+2N. */
export function getStudioBundle(messageId: string) {
  const extractions = getExtractionsForMessage(messageId);
  if (!extractions.length) {
    return extractions.map((ex) => ({ ...ex, fields: [] as ReturnType<typeof getExtractionFields>, matches: [] as ReturnType<typeof getMatchCandidates> }));
  }
  const ids = extractions.map((e) => e.id);
  const ph = ids.map(() => "?").join(",");
  const allFields = q<{
    id: string; extraction_id: string; field: string; value_json: string; evidence_span: string;
    locator_start: number; locator_end: number; confidence: number;
    extractor_version: string; verification_status: string;
    verified_by: string | null; verified_at: string | null;
  }>(
    `SELECT id, extraction_id, field, value_json, evidence_span, locator_start, locator_end, confidence,
            extractor_version, verification_status, verified_by, verified_at
       FROM extraction_fields WHERE extraction_id IN (${ph}) ORDER BY locator_start`,
    ...ids
  );
  const allMatches = q<{
    id: string; extraction_id: string; candidate_offer_id: string; confidence: number;
    reason_codes_json: string; changed_fields_json: string; reviewer_decision: string | null;
    claim_original: string | null; version: number | null;
  }>(
    `SELECT mc.id, mc.extraction_id, mc.candidate_offer_id, mc.confidence, mc.reason_codes_json,
            mc.changed_fields_json, mc.reviewer_decision, ov.claim_original, ov.version
       FROM match_candidates mc
       JOIN offers o ON o.id = mc.candidate_offer_id
       LEFT JOIN offer_versions ov ON ov.offer_id = o.id AND ov.version =
         (SELECT MAX(version) FROM offer_versions WHERE offer_id = o.id)
      WHERE mc.extraction_id IN (${ph})
      ORDER BY mc.confidence DESC`,
    ...ids
  );
  const fieldsBy = new Map<string, typeof allFields>();
  for (const f of allFields) {
    const list = fieldsBy.get(f.extraction_id) ?? [];
    list.push(f);
    fieldsBy.set(f.extraction_id, list);
  }
  const matchesBy = new Map<string, typeof allMatches>();
  for (const m of allMatches) {
    const list = matchesBy.get(m.extraction_id) ?? [];
    list.push(m);
    matchesBy.set(m.extraction_id, list);
  }
  return extractions.map((ex) => ({
    ...ex,
    fields: fieldsBy.get(ex.id) ?? [],
    matches: matchesBy.get(ex.id) ?? [],
  }));
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
    `SELECT r.id, r.offer_version_id, r.status, r.method_version, r.dimensions_json, r.sample_size,
            r.verified_by, r.decided_at, ov.claim_original, ov.offer_id, ov.version,
            c.name AS company_name, c.slug AS company_slug
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
    `SELECT cs.id, cs.company_name, cs.note, cs.status, cs.created_at, cs.matched_company_id,
            u.name AS user_name
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
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.detail_json, a.created_at,
            u.name AS actor_name
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
    `SELECT s.id, s.name, s.alias_email, s.language, s.status, s.source_confidence,
            s.subscription_type, c.name AS company_name, c.slug AS company_slug, c.id AS company_id,
            COALESCE(mc.message_count, 0) AS message_count
       FROM newsletter_sources s
       JOIN companies c ON c.id = s.company_id
       LEFT JOIN (
         SELECT source_id, COUNT(*) AS message_count FROM messages GROUP BY source_id
       ) mc ON mc.source_id = s.id
      ORDER BY c.name COLLATE NOCASE`
  );
}

export const pulseIssues = cache(function pulseIssues() {
  return q<{
    id: string; period: string; title: string; standfirst: string; blocks_json: string;
    methodology: string; sample_size: number; published_at: string | null;
  }>(`SELECT id, period, title, standfirst, blocks_json, methodology, sample_size, published_at
        FROM pulse_issues ORDER BY period DESC`);
});

export const platformStats = cache(function platformStats() {
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
});
