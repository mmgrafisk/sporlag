/**
 * Source ingestion safety (§8 / §27 BUILD_SPEC)
 * - MIME/HTML normalization, script stripping, safe link capture
 * - Normalized plain text is the evidence coordinate system: every
 *   extraction field carries character offsets into body_normalized.
 * - Raw source is private; Review Studio renders ONLY normalized text
 *   (never raw HTML, never remote scripts).
 */
import { sha256 } from "./auth";

export type SafeLink = { href: string; text: string };

export type NormalizedMessage = {
  text: string; // plain text, stable offsets
  links: SafeLink[]; // safe link capture (http/https/mailto only)
  fingerprint: string; // sha256 of normalized text (duplicate protection)
};

const BLOCK_TAGS = new Set([
  "p", "div", "br", "li", "ul", "ol", "tr", "table", "h1", "h2", "h3", "h4",
  "h5", "h6", "section", "article", "header", "footer", "blockquote", "hr", "td", "th",
]);

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  "#39": "'", "#8211": "–", "#8212": "—", "#8230": "…", ndash: "–",
  mdash: "—", hellip: "…", rarr: "→", euro: "€", copy: "©", reg: "®",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#?\w+);/g, (m, code: string) => {
    const key = code.toLowerCase();
    if (ENTITIES[key]) return ENTITIES[key];
    if (key.startsWith("#x")) {
      const cp = parseInt(key.slice(2), 16);
      if (!Number.isNaN(cp)) return String.fromCodePoint(cp);
    } else if (key.startsWith("#")) {
      const cp = parseInt(key.slice(1), 10);
      if (!Number.isNaN(cp)) return String.fromCodePoint(cp);
    }
    return m;
  });
}

/** Strip dangerous constructs; return sanitized HTML kept PRIVATE for provenance. */
export function sanitizeHtml(raw: string): string {
  let html = raw;
  // Remove script/style/iframe/object/embed/link/meta/base completely
  html = html.replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form|input|button)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  html = html.replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form|input|button)[^>]*\/?>/gi, "");
  // Remove event handler attributes
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Neutralize javascript:/data: URLs in href/src
  html = html.replace(/(href|src|action)\s*=\s*(["']?)\s*(javascript|data|vbscript):[^"'>]*/gi, '$1=$2#removed');
  return html;
}

/** Normalize to plain text with stable offsets + capture safe links. */
export function normalizeMessage(rawHtml: string): NormalizedMessage {
  const links: SafeLink[] = [];
  let html = sanitizeHtml(rawHtml);

  // Capture links BEFORE stripping tags
  html = html.replace(/<a\s[^>]*href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, _q, dq, sq, inner: string) => {
      const href = (dq ?? sq ?? "") as string;
      const text = decodeEntities(inner.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
      if (/^(https?:|mailto:)/i.test(href)) {
        links.push({ href, text: text || href });
      }
      return text; // keep anchor text in normalized flow
    });

  // Comments out
  html = html.replace(/<!--[\s\S]*?-->/g, " ");
  // Block tags -> newline boundaries; HEADINGS -> "# "-marked section lines.
  // The marker keeps offer-section structure visible in the normalized text
  // (the extractor splits multi-offer emails on these sections) and mirrors
  // the "#" heading convention reviewers already see in studio previews.
  html = html.replace(/<[^>]+>/g, (tag) => {
    const name = tag.replace(/^<\s*\/?\s*([a-zA-Z0-9]+).*$/s, "$1").toLowerCase();
    if (HEADING_TAGS.has(name)) return tag.startsWith("</") ? "\n\n" : "\n\n# ";
    return BLOCK_TAGS.has(name) ? "\n" : " ";
  });

  let text = decodeEntities(html);
  text = text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, links, fingerprint: sha256(text) };
}
