/**
 * COMMUNITY AGGREGATION (§16–§18 BUILD SPEC)
 * - Structured factual questions; language-neutral enums.
 * - Counts, never star ratings. Sample size always exposed.
 * - Small samples: show counts, not misleading precision.
 * - Contributor profile keeps points / reputation / impact SEPARATE.
 */
import { q, q1, run, nextId, nowIso } from "./db";
import { logAudit } from "./audit";

export const REVIEW_QUESTIONS = [
  "price_clarity",
  "period_clarity",
  "post_intro_clarity",
  "conditions_visibility",
] as const;
export const OUTCOME_QUESTION = "worked_as_described";
export const RESPONSE_VALUES = ["clear", "partial", "unclear", "unknown"] as const;
export const OUTCOME_VALUES = ["confirmed", "not_confirmed", "unknown"] as const;
export const POINTS_PER_REVIEW = 10;
export const SMALL_SAMPLE_THRESHOLD = 10;

export type QuestionCounts = {
  question: string;
  counts: Record<string, number>;
  total: number;
};

export type CommunitySummary = {
  sample_size: number;
  questions: QuestionCounts[];
  small_sample: boolean;
};

export function communitySummary(offerVersionId: string): CommunitySummary {
  const rows = q<{ question_key: string; response: string }>(
    `SELECT question_key, response FROM community_observations WHERE offer_version_id = ?`,
    offerVersionId
  );
  const byQ = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const c = byQ.get(r.question_key) ?? {};
    c[r.response] = (c[r.response] ?? 0) + 1;
    byQ.set(r.question_key, c);
  }
  const order = [...REVIEW_QUESTIONS, OUTCOME_QUESTION];
  const questions: QuestionCounts[] = order
    .filter((k) => byQ.has(k))
    .map((k) => {
      const counts = byQ.get(k)!;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { question: k, counts, total };
    });
  const sample_size = rows.length
    ? Math.max(...questions.map((qq) => qq.total), 0)
    : 0;
  return { sample_size, questions, small_sample: sample_size < SMALL_SAMPLE_THRESHOLD };
}

/** Distinct users who reviewed a version = sample size for display. */
export function sampleSizeOf(offerVersionId: string): number {
  return q1<{ n: number }>(
    `SELECT COUNT(DISTINCT user_id) AS n FROM community_observations WHERE offer_version_id = ?`,
    offerVersionId
  )?.n ?? 0;
}

export function recordObservations(
  offerVersionId: string,
  userId: string,
  answers: Record<string, string>
): { ok: boolean; pointsAwarded: number; error?: string } {
  const v = q1<{ id: string; publication_status: string }>(
    `SELECT id, publication_status FROM offer_versions WHERE id = ?`, offerVersionId
  );
  if (!v || v.publication_status !== "published") return { ok: false, pointsAwarded: 0, error: "not_published" };

  let inserted = 0;
  for (const [questionKey, response] of Object.entries(answers)) {
    const validValues = questionKey === OUTCOME_QUESTION ? OUTCOME_VALUES : RESPONSE_VALUES;
    if (!(validValues as readonly string[]).includes(response)) continue;
    run(
      `INSERT OR IGNORE INTO community_observations
        (id, offer_version_id, user_id, question_key, response, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      nextId("cobs", "community_observations"), offerVersionId, userId, questionKey, response, nowIso()
    );
    inserted++;
  }
  if (!inserted) return { ok: false, pointsAwarded: 0, error: "no_valid_answers" };

  // Contribution points = activity (§18). Reputation/impact are separate.
  run(
    `UPDATE contributor_profiles SET contribution_points = contribution_points + ? WHERE user_id = ?`,
    POINTS_PER_REVIEW, userId
  );
  // Impact: this user helped verify data others see — count all who reviewed this version
  const others = sampleSizeOf(offerVersionId);
  if (others > 1) {
    run(
      `UPDATE contributor_profiles SET impact_count = impact_count + ? WHERE user_id = ?`,
      others - 1, userId
    );
  }
  run(`UPDATE review_tasks SET status = 'completed', completed_at = ? WHERE user_id = ? AND offer_version_id = ?`,
    nowIso(), userId, offerVersionId);
  logAudit(userId, "community.observation", "offer_version", offerVersionId, { answers: inserted });
  return { ok: true, pointsAwarded: POINTS_PER_REVIEW };
}

/** Company-level clarity dimensions (§14) — aggregated across published versions. */
export type CompanyClarity = { key: string; percent: number | null; count: number };

export function companyClarity(companyId: string): CompanyClarity[] {
  const rows = q<{ question_key: string; response: string }>(
    `SELECT co.question_key, co.response
       FROM community_observations co
       JOIN offer_versions ov ON ov.id = co.offer_version_id
       JOIN offers o ON o.id = ov.offer_id
      WHERE o.company_id = ? AND ov.publication_status = 'published'`,
    companyId
  );
  const keys = [...REVIEW_QUESTIONS, OUTCOME_QUESTION];
  return keys.map((key) => {
    const subset = rows.filter((r) => r.question_key === key);
    const informative = subset.filter((r) => r.response !== "unknown");
    const clear = informative.filter((r) => r.response === "clear" || r.response === "confirmed");
    return {
      key,
      percent: informative.length >= 5 ? Math.round((clear.length / informative.length) * 100) : null,
      count: subset.length,
    };
  });
}
