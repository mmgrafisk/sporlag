/**
 * VALIDATION SEED — demonstrates the FULL handoff chain (§20 PROJECT MASTER)
 * using the REAL domain code paths, not shortcuts:
 *
 *  1. Company exists in Source Registry        ✓ companies + newsletter_sources
 *  2. Platform subscribes (alias)              ✓ alias_email per source
 *  3. Message is received                      ✓ ingestMessage (sanitize+fingerprint)
 *  4. Offers are detected                      ✓ runExtraction → extractOffers
 *  5. AI extracts facts + evidence             ✓ extractor-0.1 provenance envelopes
 *  6. Reviewer confirms / edits / unknown      ✓ applyFieldAction + human_corrections
 *  7. System matches against existing offers   ✓ suggestMatches + match_candidates
 *  8. Offer Version created when needed        ✓ commitVersion
 *  9. Changed fields recorded                  ✓ version_changes (279→299 kr. example)
 * 10. Verified version published (explicit)    ✓ publishVersion
 * 11. Public Offer page shows promise/terms/evidence/history ✓ public projection
 * 12. Eligible users receive review task       ✓ fanOutReviewTasks
 * 13. Community observations aggregate         ✓ community_observations + summary
 * 14. Recognition suggested / verified         ✓ storeSuggestion + verifyRecognition
 * 15. Offer Graph preserves history            ✓ versions + predecessor chain
 *
 * Newsletter content is SYNTHETIC Danish marketing copy for validation.
 * Trigger: admin → Valideringsdata, or POST /api/internal/dev-seed (admin only).
 */
import { getDb, q, q1, run, nextId, nowIso, resetIdCache } from "./db";
import { createUser, type SessionUser } from "./auth";
import { ingestMessage, runExtraction } from "./ingest";
import {
  applyFieldAction, verifyExtraction, commitVersion, publishVersion, fanOutReviewTasks,
} from "./versioning";
import { suggestMatches, type ExistingOfferForMatch } from "./matching";
import { recordObservations } from "./aggregation";
import { canonicalIdentity, type CandidateOffer, type ExtractedField } from "./extractor";
import { storeSuggestion, verifyRecognition } from "./recognition";
import { logAudit } from "./audit";

// ---------------------------------------------------------------------------
// Wipe
// ---------------------------------------------------------------------------
const WIPE_ORDER = [
  "audit_log", "rate_buckets", "pulse_issues", "brand_config",
  "recognitions", "community_observations", "review_tasks", "company_suggestions",
  "contributor_profiles", "user_newsletter_selections", "sessions", "users",
  "version_changes", "match_candidates", "evidence", "offer_versions", "offers",
  "campaigns", "human_corrections", "extraction_fields", "extractions",
  "messages", "newsletter_sources", "companies",
];

function wipe() {
  const db = getDb();
  db.exec("PRAGMA foreign_keys = OFF");
  for (const t of WIPE_ORDER) db.exec(`DELETE FROM ${t}`);
  db.exec("PRAGMA foreign_keys = ON");
  resetIdCache();
}

// ---------------------------------------------------------------------------
// Synthetic newsletter HTML (Danish marketing patterns)
// ---------------------------------------------------------------------------
function newsletter(company: string, lines: string[], opts: { withScript?: boolean } = {}): string {
  const script = opts.withScript
    ? `<script>window.tracker && window.tracker.track('open');</script>`
    : "";
  const body = lines
    .map((l) => (l.startsWith("#") ? `<h2>${l.slice(1)}</h2>` : `<p>${l}</p>`))
    .join("\n");
  return `<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"><title>${company}</title>
<style>body{font-family:sans-serif}</style>${script}</head>
<body>
<h1>${company.toUpperCase()} — NYHEDSBREV</h1>
${body}
<p><a href="https://example.dk/tilbud" onclick="track('click')">Se tilbuddet</a></p>
<footer><p>Afmeld nyhedsbrev · Persondatapolitik</p></footer>
</body></html>`;
}

const telmoreLines = (normalPrice: number, expiry: string) => [
  "#3 måneder til halv pris",
  "Mobilabonnement med 20 GB data",
  "Kun 149 kr./md. i introperioden",
  `Herefter ${normalPrice} kr./md.`,
  "Kun nye kunder",
  "6 måneders minimumsperiode",
  `Tilbuddet gælder til og med ${expiry}`,
];

const mofiboLines = (introMonths: number) => [
  "#Prøv Mofibo gratis i 14 dage",
  "Ubegrænsede lydbøger og e-bøger",
  `Derefter kun 99 kr./md. i ${introMonths} måneder`,
  "Herefter 199 kr./md.",
  "Tilbuddet gælder kun nye kunder",
];

// ---------------------------------------------------------------------------
// Seed run
// ---------------------------------------------------------------------------
export function runSeedPipeline(): { ok: boolean; summary: Record<string, number | string> } {
  wipe();

  const sys = null; // system actor

  // ---- 1. Companies (≈20 Danish brands, varied offer structures) ----------
  const companyDefs: [string, string, string][] = [
    ["Telmore", "telmore", "telecom"],
    ["Mofibo", "mofibo", "streaming"],
    ["YouSee", "yousee", "telecom"],
    ["Norlys", "norlys", "energy"],
    ["Fitness World", "fitness-world", "fitness"],
    ["Elgiganten", "elgiganten", "electronics"],
    ["Call Me", "call-me", "telecom"],
    ["Telia", "telia", "telecom"],
    ["3", "3", "telecom"],
    ["TV 2 Play", "tv-2-play", "streaming"],
    ["Viaplay", "viaplay", "streaming"],
    ["Blockbuster", "blockbuster", "streaming"],
    ["Netto", "netto", "grocery"],
    ["Bilka", "bilka", "grocery"],
    ["Coop", "coop", "grocery"],
    ["DSB", "dsb", "travel"],
    ["Scandlines", "scandlines", "travel"],
    ["Tryg", "tryg", "insurance"],
    ["Codan", "codan", "insurance"],
    ["Power", "power", "electronics"],
    ["SATS", "sats", "fitness"],
    ["Matas", "matas", "beauty"],
  ];
  const companyIds: Record<string, string> = {};
  for (const [name, slug, category] of companyDefs) {
    const id = nextId("company", "companies");
    run(
      `INSERT INTO companies (id, name, slug, market, category, status, created_at, updated_at)
       VALUES (?, ?, ?, 'DK', ?, 'active', ?, ?)`,
      id, name, slug, category, nowIso(), nowIso()
    );
    companyIds[slug] = id;
  }

  // ---- 2. Sources (platform-controlled aliases) ---------------------------
  const sourceIds: Record<string, string> = {};
  for (const [, slug] of companyDefs) {
    const id = nextId("source", "newsletter_sources");
    run(
      `INSERT INTO newsletter_sources
        (id, company_id, name, alias_email, market, language, subscription_type, status, source_confidence, created_at)
       VALUES (?, ?, ?, ?, 'DK', 'da', 'direct_public_signup', 'active', 'direct_subscription', ?)`,
      id, companyIds[slug],
      `${slug === "tv-2-play" ? "TV 2 Play" : slug[0].toUpperCase() + slug.slice(1)} marketingnyhedsbrev`,
      `${slug}@inbox.platform.local`, nowIso()
    );
    sourceIds[slug] = id;
    logAudit(sys, "source.registered", "newsletter_source", id, { company: slug });
  }

  // ---- Users & roles (§22) -------------------------------------------------
  const admin: SessionUser = createUser("admin@demo.dk", "Ada Admin", "demo1234", "admin");
  const editor: SessionUser = createUser("redaktor@demo.dk", "Rikke Redaktør", "demo1234", "editor");
  const ambassador: SessionUser = createUser("ambassadoer@demo.dk", "Anders Ambassadør", "demo1234", "ambassador");
  const freja: SessionUser = createUser("forbruger@demo.dk", "Freja Forbruger", "demo1234", "consumer");

  const syntheticNames: [string, string][] = [
    ["Lars Nielsen", "lars@demo.dk"], ["Mette Hansen", "mette@demo.dk"],
    ["Jonas Petersen", "jonas@demo.dk"], ["Sofie Andersen", "sofie@demo.dk"],
    ["Anders Kristensen", "ak@demo.dk"], ["Karen Larsen", "karen@demo.dk"],
    ["Peter Jensen", "peter@demo.dk"], ["Ida Nielsen", "ida@demo.dk"],
    ["Morten Sørensen", "morten@demo.dk"], ["Louise Rasmussen", "louise@demo.dk"],
    ["Henrik Jørgensen", "henrik@demo.dk"], ["Camilla Madsen", "camilla@demo.dk"],
    ["Thomas Christensen", "thomas@demo.dk"], ["Emma Poulsen", "emma@demo.dk"],
  ];
  const synthUsers = syntheticNames.map(([name, email]) => createUser(email, name, "demo1234", "consumer"));

  // Contributor profiles (points / reputation / impact kept SEPARATE, §18)
  const profile = (userId: string, points: number, rep: number, impact: number) =>
    run(`UPDATE contributor_profiles SET contribution_points = ?, reputation = ?, impact_count = ? WHERE user_id = ?`,
      points, rep, impact, userId);
  profile(editor.id, 640, 95, 1250);
  profile(ambassador.id, 320, 88, 210);
  profile(freja.id, 130, 68, 96);
  synthUsers.forEach((u, i) => profile(u.id, 20 + i * 35, 52 + ((i * 7) % 40), 10 + i * 57));

  // ---- Newsletter selections BEFORE publication → review-task fanout ------
  const select = (userId: string, slug: string) =>
    run(`INSERT OR IGNORE INTO user_newsletter_selections (user_id, source_id, selected_at) VALUES (?, ?, ?)`,
      userId, sourceIds[slug], nowIso());
  select(freja.id, "telmore"); select(freja.id, "mofibo"); select(freja.id, "yousee");
  select(synthUsers[0].id, "telmore"); select(synthUsers[1].id, "telmore");
  select(synthUsers[2].id, "mofibo"); select(synthUsers[3].id, "yousee");
  select(synthUsers[4].id, "norlys"); select(synthUsers[5].id, "fitness-world");

  // ---- 3–9. Ingest → extract → review → match → versions → publish --------
  type MsgDef = { slug: string; subject: string; receivedAt: string; html: string; extract: boolean };
  const D = (iso: string) => new Date(iso).toISOString();

  const messages: MsgDef[] = [
    { slug: "telmore", subject: "3 måneder til halv pris — spar 450 kr.", receivedAt: D("2026-06-10T08:12:00+02:00"), html: newsletter("Telmore", telmoreLines(299, "30. juni 2026")), extract: true },
    { slug: "telmore", subject: "Sidste chance: halv pris i sommerferien", receivedAt: D("2026-07-20T09:03:00+02:00"), html: newsletter("Telmore", telmoreLines(279, "31. juli 2026")), extract: true },
    { slug: "telmore", subject: "3 måneder til halv pris — august", receivedAt: D("2026-08-18T07:45:00+02:00"), html: newsletter("Telmore", telmoreLines(279, "31. august 2026")), extract: true },
    { slug: "telmore", subject: "Efterårstilbud: 3 måneder til halv pris", receivedAt: D("2026-09-12T08:30:00+02:00"), html: newsletter("Telmore", telmoreLines(299, "30. september 2026")), extract: true },
    // 5: identical resend → fingerprint DUPLICATE (duplicate protection §27)
    { slug: "telmore", subject: "Efterårstilbud: 3 måneder til halv pris (videresendt)", receivedAt: D("2026-09-12T18:02:00+02:00"), html: newsletter("Telmore", telmoreLines(299, "30. september 2026")), extract: false },
    { slug: "mofibo", subject: "Gratis lydbøger i 14 dage", receivedAt: D("2026-08-05T10:15:00+02:00"), html: newsletter("Mofibo", mofiboLines(3)), extract: true },
    { slug: "mofibo", subject: "Nu endnu længere introperiode", receivedAt: D("2026-09-08T10:05:00+02:00"), html: newsletter("Mofibo", mofiboLines(4)), extract: true },
    { slug: "yousee", subject: "Spar 200 kr./md. på bredbånd", receivedAt: D("2026-09-02T08:50:00+02:00"), html: newsletter("YouSee", [
      "#Spar 200 kr./md. på bredbånd i 6 måneder",
      "Hurtigt bredbånd til hele husstanden",
      "Nu kun 249 kr./md.",
      "Herefter 449 kr./md.",
      "Ingen oprettelse",
      "Tilbuddet gælder til og med 30. september 2026",
    ]), extract: true },
    // 9: extracted but left NEEDS_REVIEW — Review Studio demo
    { slug: "yousee", subject: "YouSee Play+ Film — nyhed", receivedAt: D("2026-09-09T11:20:00+02:00"), html: newsletter("YouSee", [
      "#Nyhed: YouSee Play+ Film",
      "Film og serier uden reklamer",
      "Få 3 måneder for 49 kr./md.",
      "Herefter 99 kr./md.",
      "Kun nye kunder",
    ]), extract: true },
    { slug: "norlys", subject: "Fast lav elpris i 12 måneder", receivedAt: D("2026-08-25T07:30:00+02:00"), html: newsletter("Norlys", [
      "#Fast lav pris på el i 12 måneder",
      "Skift til fast elaftale og få ro i budgettet",
      "Kun 49 kr./md. i de første 12 måneder",
      "Herefter 79 kr./md.",
      "Tilbuddet gælder kun nye kunder",
      "Oprettelse: 0 kr.",
    ]), extract: true },
    { slug: "fitness-world", subject: "Kom i form efter sommeren", receivedAt: D("2026-09-01T06:40:00+02:00"), html: newsletter("Fitness World", [
      "#Kom i form efter sommeren",
      "Træn i hele landet",
      "3 måneder for 99 kr./md.",
      "Herefter gælder almindelig medlemspris",
      "12 måneders binding",
      "Tilbuddet gælder til og med 15. oktober 2026",
    ]), extract: true },
    { slug: "elgiganten", subject: "Efterårstilbud på hvidevarer", receivedAt: D("2026-09-10T09:55:00+02:00"), html: newsletter("Elgiganten", [
      "#Efterårstilbud på udvalgte vaskemaskiner",
      "Nu fra 2.999 kr. — spar 1.000 kr.",
      "Før 3.999 kr.",
      "Tilbuddet gælder til og med 28. september 2026",
      "Kan ikke kombineres med andre tilbud",
    ]), extract: true },
    // 13: no commercial offer → NO_OFFER
    { slug: "tv-2-play", subject: "Ny dansk dramaserie har premiere", receivedAt: D("2026-09-05T12:00:00+02:00"), html: newsletter("TV 2 Play", [
      "#Ny dansk dramaserie",
      "Premiere på fredag",
      "Se de første to afsnit i forvejen",
      "God fornøjelse",
    ]), extract: true },
    // 14–15: RECEIVED only (extraction happens later in Review Studio).
    // Call Me message includes <script> + onclick to demonstrate sanitization (§27).
    { slug: "call-me", subject: "50% rabat i 2 måneder", receivedAt: D("2026-09-14T08:05:00+02:00"), html: newsletter("Call Me", [
      "#50% rabat i 2 måneder",
      "Mobilabonnement med 10 GB",
      "Kun 89 kr./md. de første 2 måneder",
      "Herefter 178 kr./md.",
      "Tilbuddet gælder kun nye kunder",
    ], { withScript: true }), extract: false },
    { slug: "netto", subject: "100 kr. rabat i denne uge", receivedAt: D("2026-09-13T07:10:00+02:00"), html: newsletter("Netto", [
      "#100 kr. rabat ved køb over 400 kr.",
      "Rabatten gælder hele sortimentet af dagligvarer",
      "Tilbuddet gælder til og med 21. september 2026",
      "Rabatten fratrækkes automatisk ved kassen",
    ]), extract: false },
  ];

  const ingestedIds: string[] = [];
  for (const m of messages) {
    const res = ingestMessage({
      sourceId: sourceIds[m.slug], subject: m.subject, rawHtml: m.html,
      receivedAt: m.receivedAt, actorId: admin.id,
    });
    if (!res.ok) continue;
    ingestedIds.push(res.messageId);
    if (m.extract) runExtraction(res.messageId);
  }

  // ---- Review + version pipeline helper (mirrors Review Studio actions) ----
  function loadCandidate(extractionId: string): CandidateOffer | null {
    const ex = q1<{ offer_type: string; headline: string | null; claim_original: string; message_id: string }>(
      `SELECT * FROM extractions WHERE id = ?`, extractionId);
    if (!ex) return null;
    const rows = q<ExtractedField & { id: string; value_json: string }>(
      `SELECT * FROM extraction_fields WHERE extraction_id = ? ORDER BY locator_start`, extractionId);
    const fields: ExtractedField[] = rows.map((r) => ({
      field: r.field, value: JSON.parse(r.value_json), evidence_span: r.evidence_span,
      locator_start: r.locator_start, locator_end: r.locator_end, confidence: r.confidence,
    }));
    return {
      is_offer: true,
      offer_type: (ex.offer_type ?? "other") as CandidateOffer["offer_type"],
      headline: ex.headline,
      supporting_claim: rows.find((r) => r.field === "supporting_claim")?.value_json
        ? (JSON.parse(rows.find((r) => r.field === "supporting_claim")!.value_json) as { text: string }).text
        : null,
      fields,
    };
  }

  function loadExistingOffers(companyId: string): ExistingOfferForMatch[] {
    return q<ExistingOfferForMatch & { fields_json: string; last_seen: string }>(
      `SELECT o.id AS offer_id, o.company_id, o.offer_type, o.canonical_identity, o.last_seen,
              ov.fields_json
         FROM offers o
         JOIN offer_versions ov ON ov.offer_id = o.id
        WHERE o.company_id = ?
          AND ov.version = (SELECT MAX(version) FROM offer_versions WHERE offer_id = o.id)`,
      companyId
    ).map((r) => ({
      offer_id: r.offer_id, company_id: r.company_id, offer_type: r.offer_type,
      canonical_identity: r.canonical_identity, last_seen: r.last_seen,
      latest_version_fields: JSON.parse(r.fields_json as unknown as string),
    }));
  }

  function reviewAndCommit(messageId: string, opts: {
    reviewer: SessionUser; publish: boolean; editField?: { field: string; value: unknown };
  }): { versionId?: string; offerId?: string } {
    const msg = q1<{ id: string; received_at: string; source_id: string }>(
      `SELECT * FROM messages WHERE id = ?`, messageId);
    if (!msg) return {};
    const src = q1<{ company_id: string }>(`SELECT company_id FROM newsletter_sources WHERE id = ?`, msg.source_id)!;
    const company = q1<{ name: string }>(`SELECT name FROM companies WHERE id = ?`, src.company_id)!;
    const extractions = q<{ id: string }>(
      `SELECT id FROM extractions WHERE message_id = ? AND is_offer = 1 AND status = 'candidate' ORDER BY offer_index`,
      messageId);

    const results: { versionId?: string; offerId?: string } = {};
    for (const exRow of extractions) {
      // 6. Reviewer confirms every field (one deliberate human EDIT for eval data)
      const fieldRows = q<{ id: string; field: string }>(
        `SELECT id, field FROM extraction_fields WHERE extraction_id = ?`, exRow.id);
      for (const f of fieldRows) {
        if (opts.editField && f.field === opts.editField.field) {
          applyFieldAction(f.id, "edit", opts.reviewer.id, opts.editField.value);
        } else {
          applyFieldAction(f.id, "confirm", opts.reviewer.id);
        }
      }
      const ver = verifyExtraction(exRow.id, opts.reviewer.id);
      if (!ver.ok) continue;

      // 7. Layered matching with reviewer accept + audit
      const candidate = loadCandidate(exRow.id);
      if (!candidate) continue;
      const existing = loadExistingOffers(src.company_id);
      const observedAt = new Date(msg.received_at);
      const suggestions = suggestMatches(src.company_id, candidate, existing, observedAt, (o) =>
        Math.round((observedAt.getTime() - new Date(o.last_seen).getTime()) / 86400000));

      let matchedOfferId: string | null = null;
      for (const s of suggestions) {
        const mcId = nextId("match", "match_candidates");
        run(
          `INSERT INTO match_candidates
            (id, extraction_id, candidate_offer_id, confidence, reason_codes_json, changed_fields_json, reviewer_decision, reviewer_id, decided_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'accept', ?, ?, ?)`,
          mcId, exRow.id, s.candidate_offer_id, s.confidence,
          JSON.stringify(s.reason_codes), JSON.stringify(s.changed_fields),
          opts.reviewer.id, nowIso(), nowIso()
        );
        logAudit(opts.reviewer.id, "match.accepted", "match_candidate", mcId, {
          offer_id: s.candidate_offer_id, confidence: s.confidence });
        if (!matchedOfferId) matchedOfferId = s.candidate_offer_id;
      }

      // 8–9. Offer Version (+ changed fields) or new Offer
      const committed = commitVersion({
        extractionId: exRow.id,
        matchedOfferId,
        reviewerId: opts.reviewer.id,
        canonicalIdentity: canonicalIdentity(company.name, candidate.offer_type, candidate.headline, candidate.fields),
        observedAt: msg.received_at,
        workingName: candidate.headline ?? "Kampagne",
      });
      if (committed.ok && committed.versionId) {
        results.versionId = committed.versionId;
        results.offerId = committed.offerId;
        // 10. Explicit publication (verification ≠ publication)
        if (opts.publish) publishVersion(committed.versionId, opts.reviewer.id);
      }
    }
    return results;
  }

  // Walk messages in received order through the pipeline
  const [mT1, mT2, mT3, mT4, mT5, mM1, mM2, mY1, mY2, mN1, mF1, mE1, mTV, mC, mN] = ingestedIds;
  const telV1 = reviewAndCommit(mT1, { reviewer: editor, publish: true,
    editField: { field: "supporting_claim", value: { text: "Mobilabonnement med 20 GB data og fri tale" } } });
  const telV2 = reviewAndCommit(mT2, { reviewer: editor, publish: true });
  const telV3 = reviewAndCommit(mT3, { reviewer: editor, publish: true });
  const telV4 = reviewAndCommit(mT4, { reviewer: editor, publish: true });
  const mofV1 = reviewAndCommit(mM1, { reviewer: editor, publish: true });
  const mofV2 = reviewAndCommit(mM2, { reviewer: editor, publish: true });
  const yseeV1 = reviewAndCommit(mY1, { reviewer: editor, publish: true });
  void reviewAndCommit(mN1, { reviewer: editor, publish: true });   // Norlys
  void reviewAndCommit(mF1, { reviewer: editor, publish: true });   // Fitness World
  void reviewAndCommit(mE1, { reviewer: editor, publish: true });   // Elgiganten
  // mT5: DUPLICATE (never extracted). mY2: NEEDS_REVIEW (studio demo).
  // mTV: NO_OFFER. mC / mN: RECEIVED.

  // ---- 13. Community observations (structured, no stars) -------------------
  const obs = (versionId: string | undefined, userId: string, answers: Record<string, string>, when: string) => {
    if (!versionId) return;
    for (const [questionKey, response] of Object.entries(answers)) {
      run(
        `INSERT OR IGNORE INTO community_observations (id, offer_version_id, user_id, question_key, response, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        nextId("cobs", "community_observations"), versionId, userId, questionKey, response, when);
    }
  };
  const A = (p: string, pe: string, post: string, c: string, w: string) => ({
    price_clarity: p, period_clarity: pe, post_intro_clarity: post,
    conditions_visibility: c, worked_as_described: w,
  });

  // Telmore v04: 14 receivers (spec §17-style aggregate)
  if (telV4.versionId) {
    const tel4Answers: Record<string, string>[] = [
      A("clear","clear","clear","clear","confirmed"), A("clear","clear","clear","clear","confirmed"),
      A("clear","clear","clear","partial","confirmed"), A("clear","clear","partial","clear","confirmed"),
      A("clear","clear","clear","clear","confirmed"), A("clear","partial","clear","partial","confirmed"),
      A("clear","clear","clear","clear","unknown"), A("partial","clear","partial","clear","confirmed"),
      A("clear","clear","clear","unclear","confirmed"), A("clear","clear","partial","clear","not_confirmed"),
      A("clear","partial","clear","partial","unknown"), A("clear","clear","clear","clear","confirmed"),
      A("clear","unknown","clear","unclear","unknown"), A("clear","clear","clear","clear","confirmed"),
    ];
    tel4Answers.forEach((ans, i) =>
      obs(telV4.versionId, synthUsers[i].id, ans,
        D(`2026-09-${String(13 + (i % 3)).padStart(2, "0")}T${String(9 + (i % 8)).padStart(2, "0")}:${String(10 + i).padStart(2, "0")}:00+02:00`)));
  }
  // Mofibo v02: 6 receivers
  if (mofV2.versionId) {
    [A("clear","clear","clear","clear","confirmed"), A("clear","clear","clear","partial","confirmed"),
     A("clear","clear","clear","clear","unknown"), A("clear","partial","clear","clear","confirmed"),
     A("clear","clear","partial","clear","confirmed"), A("clear","clear","clear","clear","confirmed"),
    ].forEach((ans, i) => obs(mofV2.versionId, synthUsers[i + 2].id, ans, D(`2026-09-${10 + i}T12:0${i}:00+02:00`)));
  }
  // YouSee v01: 5 receivers
  if (yseeV1.versionId) {
    [A("clear","clear","clear","clear","confirmed"), A("clear","clear","partial","clear","confirmed"),
     A("clear","clear","clear","partial","unknown"), A("clear","partial","clear","clear","confirmed"),
     A("partial","clear","clear","clear","confirmed"),
    ].forEach((ans, i) => obs(yseeV1.versionId, synthUsers[i + 5].id, ans, D(`2026-09-${String(6 + i).padStart(2, "0")}T15:00:00+02:00`)));
  }
  // Norlys v01: 4 receivers
  const norlysV = q1<{ id: string }>(
    `SELECT ov.id FROM offer_versions ov JOIN offers o ON o.id = ov.offer_id
      WHERE o.company_id = ? AND ov.publication_status = 'published' ORDER BY ov.version DESC LIMIT 1`,
    companyIds["norlys"]);
  if (norlysV) {
    [A("clear","clear","clear","clear","confirmed"), A("clear","clear","clear","partial","confirmed"),
     A("clear","unknown","clear","clear","unknown"), A("clear","clear","partial","clear","confirmed"),
    ].forEach((ans, i) => obs(norlysV.id, synthUsers[i + 8].id, ans, D(`2026-09-0${3 + i}T10:30:00+02:00`)));
  }
  // Fitness World v01: 3 receivers — notable unclear on post-intro price
  const fwV = q1<{ id: string }>(
    `SELECT ov.id FROM offer_versions ov JOIN offers o ON o.id = ov.offer_id
      WHERE o.company_id = ? AND ov.publication_status = 'published' ORDER BY ov.version DESC LIMIT 1`,
    companyIds["fitness-world"]);
  if (fwV) {
    [A("clear","clear","unclear","unclear","not_confirmed"), A("clear","clear","unclear","partial","unknown"),
     A("clear","partial","unclear","unclear","not_confirmed"),
    ].forEach((ans, i) => obs(fwV.id, synthUsers[i + 10].id, ans, D(`2026-09-0${5 + i}T18:20:00+02:00`)));
  }

  // Freja completes one review through the real consumer flow (task → answers)
  if (telV1.versionId) {
    recordObservations(telV1.versionId, freja.id, A("clear", "clear", "partial", "clear", "confirmed"));
  }
  profile(freja.id, 130 + 10, 68, 96); // +10 from the completed review

  // ---- 14. Recognition (suggested by engine, human-verified) ---------------
  const recognize = (versionId: string | undefined, verify: boolean) => {
    if (!versionId) return;
    storeSuggestion(versionId, sys);
    if (verify) {
      const r = q1<{ id: string }>(`SELECT id FROM recognitions WHERE offer_version_id = ?`, versionId);
      if (r) verifyRecognition(r.id, editor.id);
    }
  };
  recognize(telV4.versionId, true);   // clearly_documented — verified
  recognize(mofV2.versionId, true);   // clearly_documented — verified
  recognize(yseeV1.versionId, false); // suggestion awaiting editor verification
  recognize(norlysV?.id, false);      // suggestion awaiting editor verification
  recognize(fwV?.id, true);           // insufficient_documentation — verified as insufficient
  const elgiV = q1<{ id: string }>(
    `SELECT ov.id FROM offer_versions ov JOIN offers o ON o.id = ov.offer_id
      WHERE o.company_id = ? AND ov.publication_status = 'published' ORDER BY ov.version DESC LIMIT 1`,
    companyIds["elgiganten"]);
  recognize(elgiV?.id, true);         // clearly_documented from evidence alone (sample 0)

  // Review-task fanout for recognitions/versions published before selections existed
  for (const v of [elgiV?.id, norlysV?.id, fwV?.id]) if (v) fanOutReviewTasks(v);

  // ---- 12. One pending company suggestion (moderation demo) ----------------
  const sugId = nextId("csug", "company_suggestions");
  run(
    `INSERT INTO company_suggestions (id, user_id, company_name, note, status, created_at)
     VALUES (?, ?, 'Gorm''s Pizza', 'Modtager deres nyhedsbrev med ugetilbud', 'pending', ?)`,
    sugId, freja.id, nowIso());
  logAudit(freja.id, "suggestion.created", "company_suggestion", sugId, {});

  // ---- 20. Market Pulse — September 2026 (editorial, methodology visible) --
  const stats = q1<{
    subVersions: number; withPost: number; newCust: number; publishedVersions: number; observations: number;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM offer_versions ov JOIN offers o ON o.id=ov.offer_id
        WHERE ov.publication_status='published' AND o.offer_type IN ('subscription_discount','free_trial')) AS subVersions,
      (SELECT COUNT(*) FROM offer_versions ov JOIN offers o ON o.id=ov.offer_id
        WHERE ov.publication_status='published' AND o.offer_type IN ('subscription_discount','free_trial')
          AND (ov.fields_json LIKE '%"normal_price"%')) AS withPost,
      (SELECT COUNT(*) FROM offer_versions ov
        WHERE ov.publication_status='published' AND ov.fields_json LIKE '%"new_customers"%') AS newCust,
      (SELECT COUNT(*) FROM offer_versions WHERE publication_status='published') AS publishedVersions,
      (SELECT COUNT(*) FROM community_observations co JOIN offer_versions ov ON ov.id=co.offer_version_id
        WHERE ov.publication_status='published') AS observations`
  )!;
  const telChange = q1<{ old_value_json: string; new_value_json: string }>(
    `SELECT vc.old_value_json, vc.new_value_json FROM version_changes vc
      JOIN offer_versions ov ON ov.id = vc.successor_version_id
      JOIN offers o ON o.id = ov.offer_id
     WHERE o.company_id = ? AND vc.field = 'normal_price'
     ORDER BY vc.changed_at DESC LIMIT 1`, companyIds["telmore"]);

  const pulseId = nextId("pulse", "pulse_issues");
  run(
    `INSERT INTO pulse_issues (id, period, title, standfirst, blocks_json, methodology, sample_size, published_at)
     VALUES (?, '2026-09', ?, ?, ?, ?, ?, ?)`,
    pulseId,
    "Markedspulsen — september 2026",
    "Hvad lovede det danske marked i september? Vi har læst nyhedsbreve, dokumenteret vilkår og spurgt modtagerne.",
    JSON.stringify({
      da: {
        clearest: {
          headline: "Elgiganten: vaskemaskiner",
          body: "Rabat, før-pris, udløbsdato og undtagelser var alle dokumenteret direkte i kilden — uden at modtageren skulle lede i det lille print.",
          offer_id: elgiV ? q1<{ offer_id: string }>(`SELECT offer_id FROM offer_versions WHERE id = ?`, elgiV.id)?.offer_id : null,
        },
        improvements: {
          headline: "Mofibo forlængede introperioden",
          body: "Fra 3 til 4 måneder til 99 kr./md. — en forbedring af introduktionsvilkårene, observeret mellem to versioner af samme tilbud.",
        },
        declines: {
          headline: "Fitness World: prisen efter introperioden",
          body: "»Herefter gælder almindelig medlemspris« står der — men hvilken pris? Community svarede overvejende »ikke tydeligt«. Status: ikke tilstrækkelig dokumentation.",
        },
        patterns: {
          headline: `${stats.withPost} af ${stats.subVersions} abonnementstilbud viser prisen efter introperioden`,
          body: `${stats.newCust} tilbud nævner »kun nye kunder« som betingelse. Mønsteret er stabilt: introprisen er næsten altid tydelig — fortsættelsesprisen er det ikke altid.`,
        },
        newBrands: {
          headline: "Call Me og Netto observeret første gang",
          body: "Begge nyhedsbreve er modtaget og afventer gennemgang i Review Studio.",
        },
        changed: {
          headline: telChange
            ? `Telmore: normalpris ${JSON.parse(telChange.old_value_json).amount} → ${JSON.parse(telChange.new_value_json).amount} kr./md.`
            : "Ingen registrerede prisændringer i perioden",
          body: "Ændringen er registreret som en ny version af samme tilbud — ikke som et nyt tilbud. Se historikken på tilbudssiden.",
          offer_id: telV4.offerId ?? null,
        },
      },
      en: {
        clearest: {
          headline: "Elgiganten: washing machines",
          body: "Discount, previous price, expiry date and exclusions were all documented directly in the source — no digging in fine print.",
          offer_id: elgiV ? q1<{ offer_id: string }>(`SELECT offer_id FROM offer_versions WHERE id = ?`, elgiV.id)?.offer_id : null,
        },
        improvements: {
          headline: "Mofibo extended its intro period",
          body: "From 3 to 4 months at DKK 99/mo — an improvement of the introductory terms, observed between two versions of the same offer.",
        },
        declines: {
          headline: "Fitness World: the price after the intro period",
          body: "”Herefter gælder almindelig medlemspris” — but which price? The community mostly answered ”not clear”. Status: insufficient documentation.",
        },
        patterns: {
          headline: `${stats.withPost} of ${stats.subVersions} subscription offers show the post-intro price`,
          body: `${stats.newCust} offers mention ”new customers only”. The pattern is stable: intro prices are nearly always clear — continuation prices are not always.`,
        },
        newBrands: {
          headline: "Call Me and Netto observed for the first time",
          body: "Both newsletters received and awaiting review in Review Studio.",
        },
        changed: {
          headline: telChange
            ? `Telmore: normal price ${JSON.parse(telChange.old_value_json).amount} → ${JSON.parse(telChange.new_value_json).amount} DKK/mo`
            : "No registered price changes in the period",
          body: "The change is recorded as a new version of the same offer — not as a new offer. See the history on the offer page.",
          offer_id: telV4.offerId ?? null,
        },
      },
    }),
    `Baseret på publicerede tilbudsversioner og community-observationer i perioden. Udvælgelse er redaktionel; alle henvisninger kan åbnes på de underliggende tilbudssider. Ingen rangering uden synlig metode.`,
    stats.publishedVersions,
    nowIso()
  );

  logAudit(sys, "seed.run", "system", "seed", { messages: ingestedIds.length });

  return {
    ok: true,
    summary: {
      companies: companyDefs.length,
      sources: companyDefs.length,
      messages: ingestedIds.length,
      publishedVersions: q1<{ n: number }>(`SELECT COUNT(*) AS n FROM offer_versions WHERE publication_status='published'`)?.n ?? 0,
      offers: q1<{ n: number }>(`SELECT COUNT(*) AS n FROM offers`)?.n ?? 0,
      changes: q1<{ n: number }>(`SELECT COUNT(*) AS n FROM version_changes`)?.n ?? 0,
      observations: q1<{ n: number }>(`SELECT COUNT(*) AS n FROM community_observations`)?.n ?? 0,
      recognitions: q1<{ n: number }>(`SELECT COUNT(*) AS n FROM recognitions`)?.n ?? 0,
      corrections: q1<{ n: number }>(`SELECT COUNT(*) AS n FROM human_corrections`)?.n ?? 0,
      telmoreV4: telV4.versionId ?? "missing",
    },
  };
}
