/**
 * EXTRACTION — extractor-0.1 (§9 BUILD_SPEC)
 * ------------------------------------------------------------------
 * Contract for ANY extractor (rule-based v0.1 now, LLM later):
 *  - detect whether a message contains commercial offers (multiple supported)
 *  - extract claims + structured terms
 *  - EVERY field carries: exact evidence span, character offsets into the
 *    normalized source text, confidence, extractor_version (§6 provenance).
 *  - No field without traceable evidence may be emitted.
 *  - The extractor must NOT publish, must NOT judge legality, must NOT
 *    replace evidence with generated summaries.
 * Swappable: bump EXTRACTOR_VERSION and implement the same interface.
 */

export const EXTRACTOR_VERSION = "extractor-0.1";

export type Money = { amount: number; currency: "DKK"; period: "month" | "once" | null };
export type Months = { months: number };
export type DateValue = { date: string; raw: string };
export type Flag = { applies: true };
export type TextValue = { text: string };
export type PercentValue = { percent: number };

export type FieldValue = Money | Months | DateValue | Flag | TextValue | PercentValue;

export type ExtractedField = {
  field: string;
  value: FieldValue;
  evidence_span: string;
  locator_start: number;
  locator_end: number;
  confidence: number;
};

export type CandidateOffer = {
  is_offer: boolean;
  offer_type: "subscription_discount" | "one_time_purchase" | "bundle" | "free_trial" | "other";
  headline: string | null;
  supporting_claim: string | null;
  fields: ExtractedField[];
};

// ---------------------------------------------------------------------------
// Danish month vocabulary (source language preserved; parsing only)
// ---------------------------------------------------------------------------
const MONTHS_DA: Record<string, number> = {
  januar: 1, februar: 2, marts: 3, april: 4, maj: 5, juni: 6, juli: 7,
  august: 8, september: 9, oktober: 10, november: 11, december: 12,
};

function parseDanishNumber(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

function fmtMoney(v: Money): string {
  const amount = Number.isInteger(v.amount) ? String(v.amount) : v.amount.toFixed(2);
  return v.period === "month" ? `${amount} kr./md.` : `${amount} kr.`;
}

/** All material/commercial fields used by matching, diffs and recognition. */
export const MATERIAL_FIELDS = [
  "advertised_price", "previous_price", "normal_price", "discount",
  "intro_period", "binding_period", "expiry", "start_date",
  "new_customers", "members_only", "minimum_purchase", "fees",
  "wager_requirement", "quantity_limits", "max_benefit",
] as const;

type Hit = { span: string; start: number; end: number };

/** Find all regex hits with exact offsets. */
function findHits(text: string, re: RegExp, from = 0, to = text.length): (Hit & { m: RegExpExecArray })[] {
  const hits: (Hit & { m: RegExpExecArray })[] = [];
  const region = text.slice(from, to);
  const regex = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = regex.exec(region)) !== null) {
    if (m[0].length === 0) { regex.lastIndex++; continue; }
    hits.push({ span: m[0], start: from + m.index, end: from + m.index + m[0].length, m });
  }
  return hits;
}

// Danish number formats: 149 | 149,50 | 1.000 | 2.999 | 12.500,50
const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?`;
const PRICE_RE = new RegExp(`(${NUM})\\s*(?:kr\\.?|DKK)\\s*(?:\\/\\s*(?:md\\.?|mdr\\.?|måneden|måned))?`, "gi");
const PER_MONTH_RE = new RegExp(`(${NUM})\\s*(?:kr\\.?|DKK)\\s*\\/\\s*(?:md\\.?|mdr\\.?|måneden)`, "gi");
const COMMERCIAL_TRIGGER_RE = /(rabat|tilbud|spar\s|gratis|halv pris|\d{1,3}\s?%|kr\.?\/?md|kampagne|intro|nedsat|billig)/i;

function near(text: string, pos: number, words: RegExp, window = 90): boolean {
  const ctx = text.slice(Math.max(0, pos - window), pos + window);
  return words.test(ctx);
}

// ---------------------------------------------------------------------------
// Field extraction (each returns at most one best hit per offer region)
// ---------------------------------------------------------------------------

function extractPriceFields(text: string, regionStart: number, regionEnd: number, fields: ExtractedField[]) {
  const monthlyHits = findHits(text, PER_MONTH_RE, regionStart, regionEnd);
  const allPriceHits = findHits(text, PRICE_RE, regionStart, regionEnd);

  // "spar X kr." / "X kr. rabat" hits are discounts — never advertised prices
  const sparHits = findHits(text, new RegExp(`spar\\s+(${NUM})\\s*(?:kr\\.?|DKK)\\s*(?:\\/\\s*(?:md\\.?|mdr\\.?))?`, "i"), regionStart, regionEnd);
  const rabatHits = findHits(text, new RegExp(`(${NUM})\\s*(?:kr\\.?|DKK)\\s*rabat`, "i"), regionStart, regionEnd);
  const thresholdHits = findHits(text, new RegExp(`(?:ved køb over|minimumskøb|min\\.?\\s*køb)\\s*(?:på\\s*)?(${NUM})\\s*(?:kr\\.?|DKK)`, "i"), regionStart, regionEnd);
  const discountSpans = [...sparHits, ...rabatHits, ...thresholdHits];
  const inDiscountSpan = (pos: number) => discountSpans.some((s) => pos >= s.start && pos <= s.end + 14);
  const monthlyCandidates = monthlyHits.filter((h) => !inDiscountSpan(h.start));
  const priceCandidates = allPriceHits.filter((h) => !inDiscountSpan(h.start));

  // normal_price: keyword BEFORE price ("herefter 299 kr./md."). Strong keywords first;
  // "derefter" only when no strong keyword yields a price (avoid mis-binding in free trials).
  const priceAfterKw = (kwRe: RegExp, windowChars = 70) => {
    for (const kw of findHits(text, kwRe, regionStart, regionEnd)) {
      const after = text.slice(kw.end, Math.min(regionEnd, kw.end + windowChars));
      const pm = new RegExp(`(${NUM})\\s*(?:kr\\.?|DKK)(\\s*\\/\\s*(?:md\\.?|mdr\\.?|måneden))?`, "i").exec(after);
      if (pm) {
        const end = kw.end + pm.index + pm[0].length;
        return {
          // evidence span includes the keyword context: "Herefter 299 kr./md." (§6 example)
          span: text.slice(kw.start, end), start: kw.start, end,
          m: pm as unknown as RegExpExecArray,
          monthly: /\//.test(pm[2] ?? ""),
        };
      }
    }
    return null;
  };
  const normalKw = priceAfterKw(/(herefter|efter intro(?:perioden)?|efter kampagne(?:perioden)?|efterfølgende|normalpris(?:en)?\s*(?:er|:)?)/i)
    ?? priceAfterKw(/(derefter|herefter betaler du)/i);
  if (normalKw) {
    fields.push({
      field: "normal_price",
      value: { amount: parseDanishNumber(normalKw.m[1]), currency: "DKK", period: normalKw.monthly ? "month" : null },
      evidence_span: normalKw.span, locator_start: normalKw.start, locator_end: normalKw.end,
      confidence: 0.95,
    });
  }

  // previous_price: keyword BEFORE price ("Før 3.999 kr."), never "første"
  const prevKw = priceAfterKw(/(førpris(?:en)?|før-pris|oprindelig(?:e)?\s+pris|normalt|plejer at koste|før(?!\s*ste)\b)/i, 50);
  const prevHit = prevKw && prevKw.start !== normalKw?.start ? prevKw : null;
  if (prevHit) {
    fields.push({
      field: "previous_price",
      value: { amount: parseDanishNumber(prevHit.m[1]), currency: "DKK", period: prevHit.monthly ? "month" : null },
      evidence_span: prevHit.span, locator_start: prevHit.start, locator_end: prevHit.end,
      confidence: 0.8,
    });
  }

  // advertised_price: first monthly price that is NOT normal/previous/discount
  const advHit = monthlyCandidates.find((h) => h.start !== normalKw?.start && h.start !== prevHit?.start);
  if (advHit) {
    fields.push({
      field: "advertised_price",
      value: { amount: parseDanishNumber(advHit.m[1]), currency: "DKK", period: "month" },
      evidence_span: advHit.span, locator_start: advHit.start, locator_end: advHit.end,
      confidence: 0.92,
    });
  } else if (!normalKw) {
    // one-time purchase price (not monthly, not previous, not discount)
    const p = priceCandidates.find((h) =>
      h.start !== prevHit?.start && !/\/\s*(md|mdr|måned)/i.test(h.span));
    if (p) {
      fields.push({
        field: "advertised_price",
        value: { amount: parseDanishNumber(p.m[1]), currency: "DKK", period: "once" },
        evidence_span: p.span, locator_start: p.start, locator_end: p.end,
        confidence: 0.85,
      });
    }
  }

  // discount: "spar X kr" / "X kr. rabat" / "X % rabat" / "halv pris"
  const sparHit = sparHits[0] ?? rabatHits[0];
  const pctHit = findHits(text, /(\d{1,3})\s?%\s*(?:rabat|besparelse|lavere|billigere)?/i, regionStart, regionEnd)[0];
  const halvHit = findHits(text, /halv pris|til det halve/i, regionStart, regionEnd)[0];
  if (sparHit) {
    fields.push({
      field: "discount",
      value: { amount: parseDanishNumber(sparHit.m[1]), currency: "DKK", period: /\/\s*(md|mdr)/i.test(sparHit.span) ? "month" : null } as Money,
      evidence_span: sparHit.span, locator_start: sparHit.start, locator_end: sparHit.end,
      confidence: 0.9,
    });
  } else if (halvHit) {
    fields.push({
      field: "discount", value: { percent: 50 },
      evidence_span: halvHit.span, locator_start: halvHit.start, locator_end: halvHit.end,
      confidence: 0.88,
    });
  } else if (pctHit && Number(pctHit.m[1]) <= 95) {
    fields.push({
      field: "discount", value: { percent: Number(pctHit.m[1]) },
      evidence_span: pctHit.span, locator_start: pctHit.start, locator_end: pctHit.end,
      confidence: 0.85,
    });
  }

  // fees: "oprettelse ... X kr" / "gebyr"
  const feeHit = findHits(text, /oprettelse(?:s(?:pris|gebyr))?\s*(?::|koster|på|\-)?\s*(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:kr\.?|DKK)|(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:kr\.?|DKK)\s*i oprettelse/i, regionStart, regionEnd)[0]
    ?? findHits(text, /oprettelse(?:s(?:pris|gebyr))?\s*(?::|\-)?\s*0\s*(?:kr\.?)?|ingen oprettelse|0\s?kr\.?\si oprettelse/i, regionStart, regionEnd)[0];
  if (feeHit) {
    const amt = feeHit.m[1] ?? feeHit.m[2] ?? "0";
    fields.push({
      field: "fees",
      value: { amount: parseDanishNumber(amt), currency: "DKK", period: "once" },
      evidence_span: feeHit.span, locator_start: feeHit.start, locator_end: feeHit.end,
      confidence: 0.88,
    });
  }

  // minimum_purchase
  const minHit = findHits(text, /(?:minimumskøb|min\.?\s*køb|ved køb over|køb for mindst)\s*(?:på\s*)?(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:kr\.?|DKK)/i, regionStart, regionEnd)[0];
  if (minHit) {
    fields.push({
      field: "minimum_purchase",
      value: { amount: parseDanishNumber(minHit.m[1]), currency: "DKK", period: null },
      evidence_span: minHit.span, locator_start: minHit.start, locator_end: minHit.end,
      confidence: 0.87,
    });
  }

  // max_benefit
  const maxHit = findHits(text, /(?:maks(?:imal)?(?:t|e)?\s*(?:rabat|besparelse|fordel)|op til|højst)\s*(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:kr\.?|DKK)/i, regionStart, regionEnd)[0];
  if (maxHit) {
    fields.push({
      field: "max_benefit",
      value: { amount: parseDanishNumber(maxHit.m[1]), currency: "DKK", period: null },
      evidence_span: maxHit.span, locator_start: maxHit.start, locator_end: maxHit.end,
      confidence: 0.82,
    });
  }

  // wager_requirement
  const wagerHit = findHits(text, /(?:gennemspils?krav|omsætningskrav|spil for)\s*(?:på\s*)?(\d{1,3})\s?(?:x|gange)?/i, regionStart, regionEnd)[0];
  if (wagerHit) {
    fields.push({
      field: "wager_requirement",
      value: { text: wagerHit.span },
      evidence_span: wagerHit.span, locator_start: wagerHit.start, locator_end: wagerHit.end,
      confidence: 0.8,
    });
  }
}

function extractTimeFields(text: string, regionStart: number, regionEnd: number, fields: ExtractedField[]) {
  // intro_period: "første X måneder", "X måneder til ...", "i X måneder/mdr", "introduktionsperiode"
  const introHit = findHits(text, /første\s+(\d{1,2})\s*(?:måneder|måned|mdr\.?)|(\d{1,2})\s*(?:måneder|mdr\.?)\s+(?:til|for|på)|introduktionsperiode\s+(?:på\s+)?(\d{1,2})|i\s+(\d{1,2})\s*(?:måneder|mdr\.?)/i, regionStart, regionEnd)[0];
  if (introHit) {
    const months = Number(introHit.m[1] ?? introHit.m[2] ?? introHit.m[3] ?? introHit.m[4]);
    fields.push({
      field: "intro_period", value: { months },
      evidence_span: introHit.span, locator_start: introHit.start, locator_end: introHit.end,
      confidence: 0.93,
    });
  }

  // binding_period
  const bindHit = findHits(text, /(\d{1,2})\s*(?:måneders|mdrs?\.?)\s*(?:binding|minimumsperiode|bindingsperiode)|(?:binding|minimumsperiode)\s*(?:på\s*)?(\d{1,2})\s*(?:måneder|mdr\.?)/i, regionStart, regionEnd)[0];
  if (bindHit) {
    const months = Number(bindHit.m[1] ?? bindHit.m[2]);
    fields.push({
      field: "binding_period", value: { months },
      evidence_span: bindHit.span, locator_start: bindHit.start, locator_end: bindHit.end,
      confidence: 0.94,
    });
  }

  // start_date / expiry: "gælder fra X", "til og med X", "indtil X", "senest X", "frist X"
  const datePat = (prefix: string) =>
    new RegExp(`(?:${prefix})\\s*(?:den\\s*)?(d\\.?\\s*)?(\\d{1,2})\\.?\\s+(januar|februar|marts|april|maj|juni|juli|august|september|oktober|november|december)(?:\\s+(\\d{4}))?`, "i");
  const fromHit = findHits(text, datePat("(?:gælder|gyldig)\\s+fra|fra og med"), regionStart, regionEnd)[0];
  const toHit = findHits(text, datePat("til og med|gælder til|indtil|senest|frist|udløber|kun til|gyldig til"), regionStart, regionEnd)[0];
  const iso = (h: { m: RegExpExecArray }, yearNow: number): string => {
    const day = h.m[2].padStart(2, "0");
    const mon = String(MONTHS_DA[h.m[3].toLowerCase()] ?? 1).padStart(2, "0");
    const year = h.m[4] ?? String(yearNow);
    return `${year}-${mon}-${day}`;
  };
  const nowYear = new Date().getFullYear();
  if (fromHit) {
    fields.push({
      field: "start_date", value: { date: iso(fromHit, nowYear), raw: fromHit.span },
      evidence_span: fromHit.span, locator_start: fromHit.start, locator_end: fromHit.end,
      confidence: 0.85,
    });
  }
  if (toHit) {
    fields.push({
      field: "expiry", value: { date: iso(toHit, nowYear), raw: toHit.span },
      evidence_span: toHit.span, locator_start: toHit.start, locator_end: toHit.end,
      confidence: 0.85,
    });
  }

  // renewal: "fortsætter automatisk|automatisk fornyelse"
  const renewHit = findHits(text, /fortsætter automatisk|automatisk (?:fornyelse|forlænges)|fornys automatisk/i, regionStart, regionEnd)[0];
  if (renewHit) {
    fields.push({
      field: "renewal", value: { text: renewHit.span },
      evidence_span: renewHit.span, locator_start: renewHit.start, locator_end: renewHit.end,
      confidence: 0.86,
    });
  }
}

function extractEligibilityFields(text: string, regionStart: number, regionEnd: number, fields: ExtractedField[]) {
  const newCust = findHits(text, /kun(?:\s+for)? nye kunder|gælder kun nye kunder|nye kunder|kun nyoprettede/i, regionStart, regionEnd)[0];
  if (newCust) {
    fields.push({
      field: "new_customers", value: { applies: true },
      evidence_span: newCust.span, locator_start: newCust.start, locator_end: newCust.end,
      confidence: 0.95,
    });
  }
  const members = findHits(text, /kun for medlemmer|som medlem af|kræver medlemskab|medlemspris/i, regionStart, regionEnd)[0];
  if (members) {
    fields.push({
      field: "members_only", value: { applies: true },
      evidence_span: members.span, locator_start: members.start, locator_end: members.end,
      confidence: 0.9,
    });
  }
  const geo = findHits(text, /gælder(?:\s+kun)?\s+i\s+(Danmark|Hele Danmark|udvalgte (?:byer|butiker))|kun i Danmark/i, regionStart, regionEnd)[0];
  if (geo) {
    fields.push({
      field: "geography", value: { text: geo.span },
      evidence_span: geo.span, locator_start: geo.start, locator_end: geo.end,
      confidence: 0.84,
    });
  }
  const selected = findHits(text, /udvalgte\s+(?:produkter|varer|modeller|abonnementer|titler|maskiner|vaskemaskiner|hvidevarer|bøger|film|serier|varer)/i, regionStart, regionEnd)[0];
  if (selected) {
    fields.push({
      field: "selected_products", value: { text: selected.span },
      evidence_span: selected.span, locator_start: selected.start, locator_end: selected.end,
      confidence: 0.86,
    });
  }
  const qty = findHits(text, /(?:begrænset antal|kun\s+\d+\s+(?:stk|pladser|abonnementer)|maks(?:imalt)?\.?\s*\d+\s+(?:stk|pr\.?\s*(?:kunde|husstand))|per (?:kunde|husstand))/i, regionStart, regionEnd)[0];
  if (qty) {
    fields.push({
      field: "quantity_limits", value: { text: qty.span },
      evidence_span: qty.span, locator_start: qty.start, locator_end: qty.end,
      confidence: 0.83,
    });
  }
  const excl = findHits(text, /(?:gælder ikke|kan ikke kombineres|ekskl\.|eksklusiv|undtaget|fragt (?:tilkommer|ikke inkluderet))[^.\n]*/i, regionStart, regionEnd)[0];
  if (excl) {
    fields.push({
      field: "exclusions", value: { text: excl.span.trim() },
      evidence_span: excl.span.trim(), locator_start: excl.start, locator_end: excl.start + excl.span.trim().length,
      confidence: 0.8,
    });
  }
}

/** Headline / claim detection within a region: first claim-y line in document order. */
function extractClaim(text: string, regionStart: number, regionEnd: number): { headline: string | null; supporting: string | null; headlineHit?: Hit } {
  const region = text.slice(regionStart, regionEnd);
  const lineOffsets: { line: string; start: number; end: number }[] = [];
  let offset = 0;
  for (const raw of region.split("\n")) {
    const trimmed = raw.trim();
    if (trimmed) {
      lineOffsets.push({
        line: trimmed,
        start: regionStart + offset + (raw.length - raw.trimStart().length),
        end: regionStart + offset + (raw.length - raw.trimEnd().length),
      });
    }
    offset += raw.length + 1;
  }

  const CLAIMY = /(tilbud|rabat|besparelse|spar|gratis|halv pris|\d{1,3}\s?%|\d+\s?kr|pris|kampagne|intro|abonnement|nedsat|fordel|medlemskab|startpakke|prøv)/i;
  const META = /nyhedsbrev|newsletter|afmeld|unsubscribe|persondatapolitik|cookie/i;

  let headlineIdx = -1;
  for (let i = 0; i < lineOffsets.length; i++) {
    const l = lineOffsets[i].line;
    if (l.length >= 6 && l.length <= 120 && !META.test(l) && CLAIMY.test(l)) {
      headlineIdx = i;
      break;
    }
  }
  if (headlineIdx === -1) return { headline: null, supporting: null };

  const head = lineOffsets[headlineIdx];
  let supporting: string | null = null;
  for (let i = headlineIdx + 1; i < lineOffsets.length && i <= headlineIdx + 2; i++) {
    const l = lineOffsets[i].line;
    if (l !== head.line && l.length >= 6 && l.length <= 160 && !META.test(l)) { supporting = l; break; }
  }
  return {
    headline: head.line,
    supporting,
    headlineHit: { span: head.line, start: head.start, end: head.end },
  };
}

function inferOfferType(fields: ExtractedField[], text: string, regionStart: number, regionEnd: number): CandidateOffer["offer_type"] {
  const has = (f: string) => fields.some((x) => x.field === f);
  const regionText = text.slice(regionStart, regionEnd);
  if (/gratis\s+(?:i\s+\d+\s+dage|prøv|prøveperiode|første)|prøv\s+[^.\n]{0,40}gratis|0\s+kr\.?\s+i\s+(?:de\s+)?første/i.test(regionText)) return "free_trial";
  if (has("binding_period") || has("intro_period") || has("normal_price") || /\/\s*(md|mdr|måned)/i.test(regionText)) return "subscription_discount";
  if (/bundle|pakke(?:pris|løsning)|samle(?:t|pakke)|kombinér/i.test(regionText)) return "bundle";
  return "one_time_purchase";
}

// ---------------------------------------------------------------------------
// Offer region detection (multiple offers per message supported)
// ---------------------------------------------------------------------------

function findOfferRegions(text: string): { start: number; end: number }[] {
  const anchors: number[] = [];
  for (const re of [PER_MONTH_RE, /spar\s+\d/gi, /halv pris/gi, /\d{1,3}\s?%\s?rabat/gi, /gratis prøve/gi]) {
    for (const h of findHits(text, re)) anchors.push(h.start);
  }
  if (!anchors.length) return [];
  anchors.sort((a, b) => a - b);

  const WINDOW = 1400; // characters; newsletter offers cluster tightly
  const regions: { start: number; end: number }[] = [];
  let cur = { start: anchors[0], end: anchors[0] + WINDOW };
  for (const a of anchors.slice(1)) {
    if (a - cur.end < WINDOW / 2) {
      cur.end = Math.max(cur.end, a + WINDOW / 2);
    } else {
      regions.push(cur);
      cur = { start: a, end: a + WINDOW };
    }
  }
  regions.push(cur);

  // Snap to line boundaries and clamp
  return regions.map((r) => {
    let start = text.lastIndexOf("\n", Math.max(0, r.start - 300));
    start = start === -1 ? 0 : start + 1;
    let end = text.indexOf("\n\n", Math.min(text.length, r.end));
    if (end === -1) end = text.length;
    return { start, end: Math.min(text.length, end + 1) };
  });
}

/** Main entry: message normalized text → candidate offers with provenance. */
export function extractOffers(text: string): CandidateOffer[] {
  const regions = findOfferRegions(text);
  const candidates: CandidateOffer[] = [];

  for (const r of regions) {
    const regionText = text.slice(r.start, r.end);
    if (!COMMERCIAL_TRIGGER_RE.test(regionText)) continue;

    const fields: ExtractedField[] = [];
    extractPriceFields(text, r.start, r.end, fields);
    extractTimeFields(text, r.start, r.end, fields);
    extractEligibilityFields(text, r.start, r.end, fields);

    const pricePresent = fields.some((f) => ["advertised_price", "normal_price", "discount", "fees"].includes(f.field));
    if (!pricePresent) continue; // no economics → not a commercial offer region

    const claim = extractClaim(text, r.start, r.end);
    const offerType = inferOfferType(fields, text, r.start, r.end);

    if (claim.headline && claim.headlineHit) {
      fields.push({
        field: "headline",
        value: { text: claim.headline },
        evidence_span: claim.headline,
        locator_start: claim.headlineHit.start,
        locator_end: claim.headlineHit.end,
        confidence: 0.8,
      });
    }
    if (claim.supporting) {
      const sIdx = regionText.indexOf(claim.supporting);
      if (sIdx !== -1) {
        fields.push({
          field: "supporting_claim",
          value: { text: claim.supporting },
          evidence_span: claim.supporting,
          locator_start: r.start + sIdx,
          locator_end: r.start + sIdx + claim.supporting.length,
          confidence: 0.72,
        });
      }
    }

    candidates.push({
      is_offer: true,
      offer_type: offerType,
      headline: claim.headline,
      supporting_claim: claim.supporting,
      fields,
    });
  }

  return candidates;
}

/** Normalized identity string for same-offer matching (§11). */
export function canonicalIdentity(companyName: string, offerType: string, claim: string | null, fields: ExtractedField[]): string {
  const adv = fields.find((f) => f.field === "advertised_price");
  const intro = fields.find((f) => f.field === "intro_period");
  const parts = [
    companyName.toLowerCase(),
    offerType,
    adv ? fmtMoney(adv.value as Money) : "",
    intro ? `${(intro.value as Months).months}md` : "",
    (claim ?? "").toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 80),
  ];
  return parts.filter(Boolean).join("|");
}

export { fmtMoney as formatMoneyValue };
