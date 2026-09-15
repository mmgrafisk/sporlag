/**
 * Company logos — fetched when a company is added, then cached on disk.
 * Public render never waits on the network: missing files fall back to
 * /logos/{slug}.svg (or an initials mark generated on first insert).
 */
import fs from "node:fs";
import path from "node:path";
import { q1, run, nextId, nowIso } from "./db";

export const KNOWN_DOMAINS: Record<string, string> = {
  telmore: "telmore.dk",
  mofibo: "mofibo.com",
  yousee: "yousee.dk",
  norlys: "norlys.dk",
  "fitness-world": "fitnessworld.com",
  elgiganten: "elgiganten.dk",
  "call-me": "callme.dk",
  telia: "telia.dk",
  "3": "3.dk",
  "tv-2-play": "tv2play.dk",
  viaplay: "viaplay.com",
  blockbuster: "blockbuster.dk",
  netto: "netto.dk",
  bilka: "bilka.dk",
  coop: "coop.dk",
  dsb: "dsb.dk",
  scandlines: "scandlines.dk",
  tryg: "tryg.dk",
  codan: "codan.dk",
  power: "power.dk",
  sats: "sats.dk",
  matas: "matas.dk",
};

function publicDir(): string {
  const dir = path.join(process.cwd(), "public", "logos");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function slugifyCompany(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "company";
}

export function guessDomain(name: string, slug: string, website?: string | null): string | null {
  if (website) {
    try {
      const host = new URL(website.includes("://") ? website : `https://${website}`).hostname.replace(/^www\./, "");
      if (host.includes(".")) return host;
    } catch { /* ignore */ }
  }
  if (KNOWN_DOMAINS[slug]) return KNOWN_DOMAINS[slug];
  const compact = slug.replace(/[^a-z0-9-]/g, "");
  if (compact) return `${compact}.dk`;
  const fromName = name.toLowerCase().replace(/[^a-z0-9]+/g, "") + ".dk";
  return fromName.length > 4 ? fromName : null;
}

export function resolveLogoSrc(slug: string, logoPath?: string | null): string {
  const root = process.cwd();
  if (logoPath) {
    const rel = logoPath.replace(/^\//, "");
    if (fs.existsSync(path.join(root, "public", rel))) {
      return logoPath.startsWith("/") ? logoPath : `/${logoPath}`;
    }
  }
  for (const ext of ["png", "jpg", "jpeg", "webp", "svg", "ico"]) {
    const file = path.join(root, "public", "logos", `${slug}.${ext}`);
    if (fs.existsSync(file)) return `/logos/${slug}.${ext}`;
  }
  return `/logos/${slug}.svg`;
}

function writeFallbackSvg(slug: string, name: string): string {
  const dest = path.join(publicDir(), `${slug}.svg`);
  if (fs.existsSync(dest)) return `/logos/${slug}.svg`;
  const letter = (name.replace(/[^A-Za-z0-9ÆØÅæøå]/g, "").slice(0, 1) || "?").toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">` +
    `<rect width="32" height="32" rx="8" fill="#1A3D32"/>` +
    `<text x="16" y="21.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#F7F5F0">${letter}</text>` +
    `</svg>\n`;
  fs.writeFileSync(dest, svg);
  return `/logos/${slug}.svg`;
}

async function download(url: string, timeoutMs = 5000): Promise<{ buf: Buffer; contentType: string } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "SporlagLogoBot/1.0 (+https://localhost)" },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!/image|octet-stream|icon|svg/i.test(contentType) && !url.match(/\.(png|jpe?g|webp|svg|ico)(\?|$)/i)) {
      return null;
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength < 80 || ab.byteLength > 1_500_000) return null;
    return { buf: Buffer.from(ab), contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function extOf(url: string, contentType: string): string {
  if (/svg/i.test(contentType) || /\.svg(\?|$)/i.test(url)) return "svg";
  if (/webp/i.test(contentType) || /\.webp(\?|$)/i.test(url)) return "webp";
  if (/jpe?g/i.test(contentType) || /\.jpe?g(\?|$)/i.test(url)) return "jpg";
  if (/png/i.test(contentType) || /\.png(\?|$)/i.test(url)) return "png";
  if (/icon/i.test(contentType) || /\.ico(\?|$)/i.test(url)) return "ico";
  return "png";
}

function persistPath(companyId: string | undefined, logoPath: string | null) {
  if (!companyId || !logoPath) return;
  try {
    run(`UPDATE companies SET logo_path = ?, updated_at = ? WHERE id = ?`, logoPath, nowIso(), companyId);
  } catch { /* column may not exist during very first boot */ }
}

/** Fetch a logo for a company and persist it. Safe to call after insert. */
export async function ensureCompanyLogo(opts: {
  slug: string;
  name: string;
  website?: string | null;
  companyId?: string;
}): Promise<string> {
  const existing = resolveLogoSrc(opts.slug, null);
  const abs = path.join(process.cwd(), "public", existing.replace(/^\//, ""));
  if (fs.existsSync(abs) && !existing.endsWith(".svg")) {
    persistPath(opts.companyId, existing);
    return existing;
  }

  const domain = guessDomain(opts.name, opts.slug, opts.website);
  if (domain) {
    const candidates = [
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `https://${domain}/apple-touch-icon.png`,
      `https://${domain}/apple-touch-icon-precomposed.png`,
      `https://${domain}/favicon.ico`,
      `https://www.${domain}/favicon.ico`,
    ];
    const dir = publicDir();
    for (const url of candidates) {
      const got = await download(url);
      if (!got) continue;
      const ext = extOf(url, got.contentType);
      fs.writeFileSync(path.join(dir, `${opts.slug}.${ext}`), got.buf);
      const publicPath = `/logos/${opts.slug}.${ext}`;
      persistPath(opts.companyId, publicPath);
      return publicPath;
    }
  }

  const fallback = fs.existsSync(abs) ? existing : writeFallbackSvg(opts.slug, opts.name);
  persistPath(opts.companyId, fallback);
  return fallback;
}

export function insertCompanyRecord(opts: {
  name: string;
  slug?: string;
  category?: string | null;
  website?: string | null;
}): { id: string; slug: string; website: string | null } {
  let slug = opts.slug || slugifyCompany(opts.name);
  const base = slug;
  let n = 2;
  while (q1(`SELECT id FROM companies WHERE slug = ?`, slug)) {
    slug = `${base}-${n++}`;
  }
  const id = nextId("company", "companies");
  const website = opts.website
    ? (opts.website.includes("://") ? opts.website : `https://${opts.website}`)
    : (KNOWN_DOMAINS[slug] ? `https://${KNOWN_DOMAINS[slug]}` : null);
  const logo = resolveLogoSrc(slug, null);
  const logoExists = fs.existsSync(path.join(process.cwd(), "public", logo.replace(/^\//, "")));
  run(
    `INSERT INTO companies (id, name, slug, market, category, status, website, logo_path, created_at, updated_at)
     VALUES (?, ?, ?, 'DK', ?, 'active', ?, ?, ?, ?)`,
    id, opts.name, slug, opts.category ?? null, website, logoExists ? logo : null, nowIso(), nowIso()
  );
  return { id, slug, website };
}

export function companyBySlug(slug: string) {
  return q1<{ id: string; name: string; slug: string; website: string | null; logo_path: string | null }>(
    `SELECT id, name, slug, website, logo_path FROM companies WHERE slug = ?`, slug
  );
}
