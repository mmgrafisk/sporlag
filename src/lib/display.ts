/**
 * Display helpers — structured fields (§5 schema groups) → localized rows.
 * Source claims/evidence are never rewritten; only labels are localized.
 */
import type { Locale } from "./i18n";
import { makeT } from "./i18n";
import { fmtFieldValue } from "./format";
import type { SpecimenTerm } from "@/components/Specimen";

export const FIELD_GROUPS = {
  economics: [
    "advertised_price", "previous_price", "normal_price", "discount",
    "minimum_purchase", "deposit", "fees", "max_benefit", "advertised_value",
  ],
  time: ["start_date", "expiry", "intro_period", "binding_period", "renewal"],
  eligibility: ["new_customers", "members_only", "geography", "age", "selected_products"],
  restrictions: ["exclusions", "quantity_limits", "wager_requirement", "other_conditions"],
} as const;

export const ALL_FIELD_ORDER = [
  "headline", "supporting_claim",
  ...FIELD_GROUPS.economics, ...FIELD_GROUPS.time,
  ...FIELD_GROUPS.eligibility, ...FIELD_GROUPS.restrictions,
] as string[];

export type DisplayTerm = SpecimenTerm & { key: string };

/** The "back" of the specimen: actual conditions, grouped per §5. */
export function termsFromFields(
  fields: Record<string, unknown>,
  locale: Locale,
  opts: { skip?: string[] } = {}
): DisplayTerm[] {
  const t = makeT(locale);
  const skip = new Set(opts.skip ?? ["headline", "supporting_claim"]);
  const out: DisplayTerm[] = [];
  const seen = new Set<string>();
  for (const key of ALL_FIELD_ORDER) {
    if (skip.has(key)) continue;
    if (fields[key] === undefined || fields[key] === null) continue;
    seen.add(key);
    out.push({ key, label: t(`field.${key}`), value: fmtFieldValue(fields[key], locale) });
  }
  // any remaining fields not in the canonical order
  for (const key of Object.keys(fields)) {
    if (skip.has(key) || seen.has(key)) continue;
    out.push({ key, label: t(`field.${key}`), value: fmtFieldValue(fields[key], locale) });
  }
  return out;
}

export function offerHref(offerId: string): string {
  return `/tilbud/${offerId}`;
}
