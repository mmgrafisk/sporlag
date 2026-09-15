/**
 * SAME-OFFER MATCHING (§11 BUILD SPEC)
 * Layered — never one single semantic score:
 *   company (hard gate) → offer type → normalized claim tokens →
 *   commercial terms (intro period, advertised price) → temporal proximity.
 * Every suggestion carries confidence + reason_codes + changed_fields.
 * Reviewer decisions (accept / override) are stored on match_candidates.
 */
import type { CandidateOffer, Money, Months } from "./extractor";

export type MatchSuggestion = {
  candidate_offer_id: string;
  confidence: number;
  reason_codes: string[];
  changed_fields: string[];
};

export type ExistingOfferForMatch = {
  offer_id: string;
  company_id: string;
  offer_type: string;
  canonical_identity: string;
  last_seen: string;
  latest_version_fields: Record<string, unknown>; // fields_json of newest version
};

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-zæøå0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function moneyEq(a: unknown, b: unknown): boolean {
  const av = a as Money | undefined;
  const bv = b as Money | undefined;
  if (!av || !bv) return false;
  return av.amount === bv.amount && (av.period ?? null) === (bv.period ?? null);
}

function moneyDiff(a: unknown, b: unknown): boolean {
  const av = a as Money | undefined;
  const bv = b as Money | undefined;
  if (!av || !bv) return false;
  return av.amount !== bv.amount;
}

/** Changed material fields between extracted candidate and an offer's latest version. */
export function diffFields(
  newFields: Record<string, unknown>,
  prevFields: Record<string, unknown>
): string[] {
  const changed: string[] = [];
  const keys = new Set([...Object.keys(newFields), ...Object.keys(prevFields)]);
  for (const k of keys) {
    const a = prevFields[k];
    const b = newFields[k];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) changed.push(k);
  }
  return changed;
}

export const MATERIAL_MATCH_FIELDS = [
  "advertised_price", "normal_price", "intro_period", "binding_period",
  "expiry", "new_customers", "fees", "discount", "minimum_purchase",
];

export function diffMaterialFields(
  newFields: Record<string, unknown>,
  prevFields: Record<string, unknown>
): string[] {
  return diffFields(newFields, prevFields).filter((f) => MATERIAL_MATCH_FIELDS.includes(f));
}

export function extractFieldsToRecord(offer: CandidateOffer): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const f of offer.fields) rec[f.field] = f.value;
  return rec;
}

/**
 * Layered matching against existing offers of the same company.
 * daysSinceSeen: temporal distance between message observation and offer last_seen.
 */
export function suggestMatches(
  company_id: string,
  offer: CandidateOffer,
  existing: ExistingOfferForMatch[],
  observedAt: Date,
  daysSinceSeen: (o: ExistingOfferForMatch) => number
): MatchSuggestion[] {
  const claimTokens = tokenize(
    [offer.headline ?? "", offer.supporting_claim ?? ""].join(" ")
  );
  const newFields = extractFieldsToRecord(offer);
  const intro = newFields["intro_period"] as Months | undefined;
  const adv = newFields["advertised_price"] as Money | undefined;

  const out: MatchSuggestion[] = [];
  for (const cand of existing) {
    if (cand.company_id !== company_id) continue; // hard gate: same company
    const reasons: string[] = ["same_company"];
    let score = 0.3;

    if (cand.offer_type === offer.offer_type) {
      score += 0.2;
      reasons.push("same_offer_type");
    }

    const candClaim = cand.canonical_identity.split("|").slice(4).join("|");
    const sim = jaccard(claimTokens, tokenize(candClaim));
    if (sim >= 0.34) {
      score += Math.min(0.22, sim * 0.3);
      if (sim >= 0.5) reasons.push("claim_semantic_match");
      else reasons.push("claim_partial_match");
    }

    const prevFields = cand.latest_version_fields;
    if (intro && prevFields["intro_period"] &&
        (prevFields["intro_period"] as Months).months === intro.months) {
      score += 0.12;
      reasons.push("same_intro_period");
    }
    if (adv && moneyEq(prevFields["advertised_price"], adv)) {
      score += 0.08;
      reasons.push("same_advertised_price");
    } else if (adv && moneyDiff(prevFields["advertised_price"], adv)) {
      reasons.push("price_differs");
    }

    const days = daysSinceSeen(cand);
    if (days >= 0 && days <= 45) {
      score += 0.1;
      reasons.push("temporal_proximity");
    } else if (days > 365) {
      score -= 0.1;
      reasons.push("distant_last_seen");
    }

    const confidence = Math.max(0, Math.min(0.99, Math.round(score * 100) / 100));
    if (confidence < 0.45) continue; // below suggestion threshold

    out.push({
      candidate_offer_id: cand.offer_id,
      confidence,
      reason_codes: reasons,
      changed_fields: diffMaterialFields(newFields, prevFields),
    });
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}
