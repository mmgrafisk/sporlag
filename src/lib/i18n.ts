/**
 * i18n (§23 BUILD_SPEC / §24 DESIGN & BRAND)
 * - Primary locale da-DK, secondary en.
 * - ALL product UI strings go through locale keys — no hardcoded strings.
 * - Enums are language-neutral; display labels are keys (enumLabel).
 * - Source evidence is NEVER translated destructively: claim_original /
 *   evidence spans keep their original language (source_language column).
 */
import { cookies } from "next/headers";
import daDK from "../../locales/da-DK.json";
import en from "../../locales/en.json";

export const LOCALES = ["da-DK", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "da-DK";

const catalogs: Record<Locale, Record<string, string>> = {
  "da-DK": daDK as Record<string, string>,
  en: en as Record<string, string>,
};

export function getLocaleFromCookie(cookieValue?: string | null): Locale {
  if (cookieValue === "en") return "en";
  return "da-DK";
}

/** Server-side current locale (cookie `locale`). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return getLocaleFromCookie(store.get("locale")?.value);
}

function lookup(locale: Locale, key: string): string | undefined {
  return catalogs[locale][key];
}

/** Translate key with {var} interpolation. Falls back to da-DK, then key. */
export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  let str = lookup(locale, key) ?? lookup(DEFAULT_LOCALE, key) ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

/** Convenience translator bound to a locale. */
export function makeT(locale: Locale) {
  return (key: string, vars?: Record<string, string | number>) => t(locale, key, vars);
}

/** Language-neutral enum → display label keys. */
export function enumLabel(
  locale: Locale,
  group: "response" | "outcome" | "role" | "messageState" | "verification" | "publication" | "offerType" | "field" | "dimension" | "recognitionStatus",
  value: string
): string {
  return t(locale, `enum.${group}.${value}`);
}
