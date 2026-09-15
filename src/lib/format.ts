/**
 * Display formatting — locale-aware, no hardcoded brand meaning.
 * da-DK: 1.480 / 149,50 kr./md. / 15. september 2026
 * en:    1,480 / DKK 149.50/mo / 15 September 2026
 * Source evidence itself is NEVER reformatted (original language preserved).
 */
import type { Locale } from "./i18n";

const bcp47 = (l: Locale) => (l === "da-DK" ? "da-DK" : "en-GB");

export function fmtNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(bcp47(locale)).format(n);
}

export function fmtPercent(n: number, locale: Locale): string {
  return `${new Intl.NumberFormat(bcp47(locale)).format(n)}%`;
}

export function fmtDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(bcp47(locale), {
    day: "numeric", month: "long", year: "numeric",
  }).format(d);
}

export function fmtDateShort(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(bcp47(locale), {
    day: "2-digit", month: "short", year: "numeric",
  }).format(d);
}

export type MoneyLike = { amount: number; currency: string; period: string | null };
export type MonthsLike = { months: number };
export type DateLike = { date: string; raw?: string };

/** Render a structured field value for display (localized). */
export function fmtFieldValue(value: unknown, locale: Locale): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.amount === "number") {
      const amount = fmtNumber(v.amount, locale);
      const currency = locale === "da-DK" ? "kr." : "DKK";
      const period =
        v.period === "month" ? (locale === "da-DK" ? "/md." : "/mo") : "";
      return `${amount} ${currency}${period}`;
    }
    if (typeof v.months === "number") {
      const n = fmtNumber(v.months, locale);
      return locale === "da-DK" ? `${n} måneder` : `${n} months`;
    }
    if (typeof v.percent === "number") {
      return `${fmtNumber(v.percent, locale)}%`;
    }
    if (typeof v.date === "string") {
      return fmtDate(v.date, locale);
    }
    if (typeof v.text === "string") return v.text;
    if (v.applies === true) return locale === "da-DK" ? "Ja" : "Yes";
  }
  return String(value);
}

/** Monospace document labels — always ISO-ish, language-neutral (§8 DESIGN). */
export function docId(id: string): string {
  return id.toUpperCase().replace(/_/g, " ");
}

export function versionLabel(n: number): string {
  return `v${String(n).padStart(2, "0")}`;
}

export function offerVersionLabel(n: number): string {
  return `OFFER VERSION ${String(n).padStart(2, "0")}`;
}
