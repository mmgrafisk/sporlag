/**
 * CENTRAL BRAND CONFIGURATION (§24 BUILD_SPEC / §26 DESIGN & BRAND)
 * ------------------------------------------------------------------
 * The working brand is NOT locked. SPORLAG is a working candidate only
 * (alternates: UDSNIT, MARKBLIK). Nothing in domain logic, database
 * schema or URLs may depend on the working name. Rebranding = edit this
 * config (or the brand_config table / admin Konfiguration page).
 */
import { q1, run, nowIso } from "./db";

export type BrandConfig = {
  name: string;
  logo: string; // motif id, rendered by <BrandMark/>
  tagline: string;
  recognitionName: string;
  publicUrl: string;
  emailSender: string;
  colors: {
    canvas: string;
    paper: string;
    ink: string;
    primary: string;
    signalLime: string;
    oxide: string;
    recognition: string;
  };
};

export const DEFAULT_BRAND: BrandConfig = {
  name: process.env.BRAND_NAME || "SPORLAG",
  logo: "layers",
  tagline: "Markedet, lag for lag.",
  recognitionName: "Tydeligt dokumenteret",
  publicUrl: process.env.BRAND_PUBLIC_URL || "http://localhost:3000",
  emailSender: process.env.BRAND_EMAIL_SENDER || "inbox@platform.local",
  colors: {
    canvas: "#F2EFE7",
    paper: "#FFFDF8",
    ink: "#151515",
    primary: "#174C43",
    signalLime: "#DDF45B",
    oxide: "#B64C36",
    recognition: "#2F7A5C",
  },
};

const OVERRIDABLE_KEYS = [
  "brand.name",
  "brand.logo",
  "brand.tagline",
  "brand.recognitionName",
  "brand.publicUrl",
  "brand.emailSender",
] as const;

/** Brand with DB overrides applied (admin → Konfiguration). */
export function getBrand(): BrandConfig {
  const brand: BrandConfig = { ...DEFAULT_BRAND, colors: { ...DEFAULT_BRAND.colors } };
  for (const key of OVERRIDABLE_KEYS) {
    const row = q1<{ value: string }>(
      `SELECT value FROM brand_config WHERE key = ?`,
      key
    );
    if (row) {
      const prop = key.replace("brand.", "") as keyof BrandConfig;
      (brand as Record<string, unknown>)[prop] = row.value;
    }
  }
  return brand;
}

export function setBrandValue(key: string, value: string) {
  if (!OVERRIDABLE_KEYS.includes(key as (typeof OVERRIDABLE_KEYS)[number])) {
    throw new Error(`brand key not overridable: ${key}`);
  }
  const existing = q1(`SELECT key FROM brand_config WHERE key = ?`, key);
  if (existing) {
    run(`UPDATE brand_config SET value = ?, updated_at = ? WHERE key = ?`, value, nowIso(), key);
  } else {
    run(`INSERT INTO brand_config (key, value, updated_at) VALUES (?, ?, ?)`, key, value, nowIso());
  }
}

/** The recognition label must always be rendered from config — never hardcoded. */
export function recognitionLabel(): string {
  return getBrand().recognitionName;
}
