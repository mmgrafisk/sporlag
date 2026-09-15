# 04 — VALIDERINGSRAPPORT v1

Dato: 2026-09-15 · Branch: `arena/01a0a5b6-sporlag` · Miljø: production-build (`next start`), SQLite `data/offergraph.db`

Valideringen består af (1) et deterministisk seed, der kører hele §20-kæden gennem de
rigtige domænefunktioner, og (2) et **live API-forløb** mod den kørende server, hvor en
helt ny dansk marketing-newsletter (Telmore, to tilbud + `<script>`-injektion) sendes
gennem kæden trin for trin. Alle tests udført med `curl` + direkte DB-inspektion.

---

## A. Source ingestion — BESTÅET
- [x] 22 reale danske kilder registreret (Telmore, Mofibo, YouSee, Norlys, Fitness World, Elgiganten, Call Me, Netto …) via platform-ejede newsletter-aliases.
- [x] Besked ingesteret sikkert: `message_0016` (live, nyt HTML med `<script>alert("xss")</script>` og `onclick="steal()"`) → 200, state RECEIVED → ekstraheret.
- [x] Rå kilde forbliver privat: privat projektion returnerer kun `body_normalized_private` (ingen rå-HTML-nøgle); script/onclick strippet; uauthetiseret kald → 401. Offentlige API'er (`/api/offers/*`) eksponerer kun struktureret, publiceret indhold.

## B. Extraction — BESTÅET
- [x] Én besked → flere kandidater: multi-offer-email gav `extraction_count: 2` ("3 måneder til halv pris" + "Fri tale i 6 måneder for 99 kr./md.") som selvstændige kandidater med korrekte headlines.
- [x] Alle 13 felter på de to kandidater har `evidence_span` + locator (start/end) + `confidence` + `extractor_version` = `extractor-0.1`.
- [x] Feltkvalitet (live): advertised 139 kr./md. (0.92), discount 50 %, intro 3 mdr., expiry 31.10.2026, new_customers, normal 279 kr./md. — alle med evidence.

## C. Human review — BESTÅET
- [x] Split-screen: `/studie/beskeder/[id]` rendererer kilde + ekstraktion side om side (`.studio-layout`, kollapser til én kolonne ≤1020px).
- [x] Klik på felt → highlight: feltet er en rigtig `<button class="studio-field">`; klik sætter `active` → evidence-span highlightes i kildeteksten (`.evidence-hl`).
- [x] confirm / edit / unknown: alle tre actions kørt live (200) — edit ændrede `normal_price` 279→289, unknown sat på `supporting_claim`.
- [x] Korrektioner bevaret: `human_corrections` gemmer AI-prædiktion + menneskelig handling + ny værdi (hcorr_0085/0086 verificeret i DB).

## D. Matching / history — BESTÅET
- [x] Kandidat matcher eksisterende tilbud: live match → `offer_0001` confidence **0.94**, reason_codes inkl. `price_differs`, changed_fields detekteret.
- [x] Reviewer-override: (a) accept → version merged; (b) **reject** på `match_0006` (0.60-kandidat til forskelligt tilbud) → commit oprettede nyt tilbud `offer_0007`; audit viser `match.suggested` + `match.overridden`.
- [x] Ny OfferVersion ved materielle ændringer: `offer_version_0011` = Telmore **v5**, predecessor `offer_version_0004`.
- [x] Ændrede felter gemt: `version_changes` v5 = advertised 149→139, expiry 30.9→31.10, normal 299→**289 (menneske-redigeret værdi gik igennem)**, binding 6→null.
- [x] Historik offentlig efter publicering: `/tilbud/offer_0001` viser v01–v05 med diffs; `/api/offers/offer_0001/versions` → [1,2,3,4,5]. Seed-kæden: Telmore 299→279→279→299 (spec-eksemplet) med 6 `version_changes`.

## E. Publication — BESTÅET
- [x] Verify ≠ publish: commit svarer eksplicit `"note":"verification_is_not_publication"`; version oprettes `verified` + **`unpublished`**.
- [x] Uverificeret kan ikke publiceres ved et uheld: verify med pending felter → 400 `fields_pending`; commit uden verify → 400 `extraction_not_verified`; publish kræver verified version.
- [x] Offentlig visning = kun godkendt: før publish var v5 usynlig (`/api/offers/.../versions` = [1..4], `offer_0007` → 404); efter eksplicit publish → synlig (200, [1..5], 7 offentlige tilbud).

## F. Consumer product — BESTÅET
- [x] Explore (`/udforsk`), virksomhedsoversigt + `-profil` (`/virksomheder/telmore`), tilbudsdetalje (`/tilbud/offer_0001`) → alle 200 med indhold.
- [x] Evidence: tilbudsiden parrer hvert felt med originalt kilde-citat (`evidence-quote`, `139 kr./md.` fundet i både felt og citat).
- [x] Historik: version-rail med ændrings-markører og diffs offentligt synlig.
- [x] Nyhedsbrevsvalg: POST select → `tasks_created: 1` (backfill), DELETE deselect → ubesvaret task ryddes (verificeret i DB).
- [x] Review-kø: `/api/users/me/review-queue` returnerer tasks med felter; fanout ved publish oprettede task_0023–0028 til berettigede modtagere.
- [x] Mobil + desktop: ReviewFlow er single-column (max 640px, clamp-typografi, lodret svarliste), viewport-meta til stede, 44px tap-targets.

## G. Community — BESTÅET
- [x] Strukturerede svar gemt: 165 seed-observationer + live-svar (5 spørgsmål, kategoriske svar, ingen fritekst).
- [x] Aggregate med sample size: v5-summary gik 0→1 efter live-review; Mofibo-side viser "6 modtagere" + "Prøvestørrelse" + `small_sample`-logik (<10).
- [x] Ingen stjerne-ratings: "star" optræder kun i kommentarer ("never star ratings"); UI-tekst: "Ingen stjerne-ratings".
- [x] Point/reputation/impact adskilt: `{contribution_points: 150, reputation: 68, impact_count: 96, reviews_completed: 2}` — tre uafhængige tal; +10 point pr. review.

## H. Recognition — BESTÅET
- [x] Tilhører Offer Version: `recognitions.offer_version_id` (live: offer_version_0011 = v5).
- [x] Kriterier kan åbnes: `<dialog>` med 5 dimensioner (claim/price/condition/time/promise) + rationale-tekster.
- [x] Timestamp + version vist: "Gælder tilbudsversion v05 · Tildelt 15. september 2026 · Metode-version recognition-method-0.1".
- [x] Ingen juridisk certificerings-implikation: disclaimer "Statussen tilhører én konkret tilbudsversion … Den kan ikke købes, og den er ikke en juridisk garanti".
- [x] Flow: engine `suggest` (clearly_documented / insufficient_documentation) → **menneskelig `verify` kræves før offentlig visning** (kørt live). Fitness World = `insufficient_documentation` (label, ikke badge).

## I. i18n — BESTÅET
- [x] Al UI via locale-nøgler (`makeT`); heuristic scan fandt ingen hardkodede danske JSX-strenge.
- [x] da-DK: default, `<html lang="da">`.
- [x] en-arkitektur: cookie `locale=en` → `<html lang="en">` + engelske labels (Explore, Conditions, History, Community, Promised …).
- [x] Kildetekst forbliver original: dansk claim ("3 måneder til halv pris") og evidence ("139 kr./md.") uændret på engelsk side; `claim_original` + `source_language: da` gemt pr. version.

## J. Accessibility — BESTÅET
- [x] Tastatur: alle interaktive elementer er native `<button>`/`<a>`/`<input>`; ingen onClick på div/span som kontrol (ét stopPropagation-guard, ikke en kontrol).
- [x] Fokus synlig: `:focus-visible`-regler i designsystemet.
- [x] AA-kontrast (beregnet): ink/paper 17.96, muted-ink/paper 6.12, oxide/paper 5.81, oxide/canvas 5.14, paper/primary 9.60, recognition/paper 5.09, recognition/canvas 4.50. **Fix under validering:** `--oxide` mørknet #B64C36→#A94430 (var 4.48 på canvas = under AA for lille tekst).
- [x] Reduced motion: `@media (prefers-reduced-motion: reduce)`-blok.
- [x] Tap-targets: min-height 44px på knapper/chips (3 regler).
- [x] Semantik: `<dialog>` (ShowModal) til kriterier, `role="status"` på beskeder, `role="list/listitem/group"`, aria-labels på ikon-knapper, 17 filer med aria/label.

---

## §20-kæden (handoff success) — demonstreret live, trin for trin
| # | Trin | Evidence |
|---|------|----------|
| 1 | Virksomhed i Source Registry | Telmore = company_0001 + source_0001 (22 kilder i alt) |
| 2 | Platform abonnerer på nyhedsbrev | platform-ejet alias pr. kilde (privat rå data) |
| 3 | Besked modtaget | message_0016 ingestet live (saniteret, fingerprint) |
| 4 | Tilbud detekteret | **2 kandidater** fra én email |
| 5 | AI ekstraherer fakta + evidence | 13 felter, alle med span/locator/confidence/extractor-0.1 |
| 6 | Reviewer bekræfter/redigerer/ukendt | 6× confirm, 1× edit (279→289), 1× unknown; korrektioner gemt |
| 7 | System matcher mod eksisterende | 0.94 → offer_0001; override-path: reject → nyt tilbud offer_0007 |
| 8 | Offer Version oprettet | offer_version_0011 (v5), predecessor v4 |
| 9 | Ændrede felter registreret | 4 changes (advertised/expiry/normal/binding) |
| 10 | Verified version kan publiceres | publish 200; før publish usynlig offentligt |
| 11 | Offentlig side: løfte/vilkår/evidence/historik | /tilbud/offer_0001 (v01–v05, diffs, citater) |
| 12 | Berettigede brugere får review-task | fanout → task_0023–0028; Freja besvarede (+10 point) |
| 13 | Community-observationer aggregerer | sample_size 0→1 live; Mofibo 6; small_sample-logik |
| 14 | Recognition foreslået/verificeret | suggest → clearly_documented → human verify → stamp på siden |
| 15 | Offer Graph bevarer historikken | version-rail + version_changes + audit_log (fuldt spor) |

## Fundet og fixet under valideringen
1. **Multi-offer splitting (B3)**: `findOfferRegions` mergede alle anchors i emails <1400 tegn → altid 1 kandidat. Fix: headings (`h1–h6`) markeres `# ` i normaliseringen; regioner splittes pr. heading-sektion; `extractClaim` præfererer heading-linjer (marker strippes fra værdi/locator). Seed-regression: ingen (6 tilbud / 10 versioner / 6 changes / 4 matches identisk).
2. **AA-kontrast (J3)**: `--oxide` 4.48:1 på canvas (lille tekst) → mørknet til #A94430 (5.14:1).
3. (Tidligere i forløbet: dato-regex-alternation, manglende SQL-bind i seed-matching, CSRF mod bind-adresse i stedet for host-header, null-prototype-rækker → RSC-serialisering, ugyldige seed-timestamps.)

## Kendte begrænsninger (bevidste v1-afgrænsninger)
- Gmail/browser-extension er ikke P0 (BUILD_SPEC §31 LATER).
- Matching-scores er heuristiske (lagdelt, reviewer afgør) — ingen ML i v1.
- Recognition sample 0 er muligt (Elgiganten: evidence-baseret, "insufficient data" håndteres i dimensioner).
- Dev-seed er admin-beskyttet; kører kun uden auth på helt tom DB (first-run bootstrap).
