import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, makeT } from "@/lib/i18n";
import { getBrand } from "@/lib/brand";
import { getPublishedOffer } from "@/lib/queries";
import { termsFromFields } from "@/lib/display";
import { fmtDate, fmtDateShort, fmtFieldValue, fmtNumber, offerVersionLabel, versionLabel } from "@/lib/format";
import { currentUser } from "@/lib/auth";
import CommunitySummaryView from "@/components/CommunitySummaryView";
import RecognitionStamp from "@/components/RecognitionStamp";
import DiffBlock from "@/components/DiffBlock";
import { FileMagnifyingGlass, UsersThree, ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

/**
 * OFFER DETAIL — the most important screen (§15 DESIGN / §13 BUILD SPEC)
 * Hierarchy: Company + observed → Offer Version → LØFTET → VILKÅRENE →
 * RECOGNITION → COMMUNITY → EVIDENS → HISTORIK.
 * Public projection only: approved facts, approved evidence excerpts,
 * aggregated observations, verified recognition. No stars anywhere.
 */
export default async function OfferDetailPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const locale = await getLocale();
  const t = makeT(locale);
  const brand = getBrand();
  const user = await currentUser();
  const offer = getPublishedOffer(offerId);
  if (!offer) notFound();

  const latest = offer.latest;
  const fields = JSON.parse(latest.fields_json) as Record<string, unknown>;
  const headline = (fields["headline"] as { text?: string } | undefined)?.text ?? offer.latest.claim_original;
  const supporting = (fields["supporting_claim"] as { text?: string } | undefined)?.text ?? null;
  const advertised = fields["advertised_price"];
  const terms = termsFromFields(fields, locale, { skip: ["headline", "supporting_claim"] });

  const rec = offer.recognition;
  const showRecognition = rec && rec.verified_by;

  const sections = [
    { id: "overblik", label: t("offer.navOverview") },
    { id: "betingelser", label: t("offer.navConditions") },
    { id: "evidens", label: t("offer.navEvidence") },
    { id: "community", label: t("offer.navCommunity") },
    { id: "historik", label: t("offer.navHistory") },
  ];

  return (
    <>
      {/* ---------- header ---------- */}
      <header className="offer-hero">
        <div className="wrap">
          <p className="small muted">
            <Link href="/udforsk">{t("explore.title")}</Link> ·{" "}
            <Link href={`/virksomheder/${offer.company_slug}`}>{t("common.companies")}</Link>
          </p>
          <p className="mono mt-1" style={{ color: "var(--primary)", fontWeight: 600 }}>
            <Link href={`/virksomheder/${offer.company_slug}`} style={{ color: "inherit" }}>{offer.company_name}</Link>
            {" · "}{t("common.observed")} {fmtDate(latest.observed_at, locale)}
          </p>
          <h1 className="mt-1">{offer.latest.claim_original}</h1>
          <p className="flex gap-1 flex-wrap items-center mt-2">
            <span className="doc-id">{offerVersionLabel(latest.version)}</span>
            <span className="doc-id">{t("offer.documentId", { id: offer.offer_id })}</span>
            <span className="doc-id">{t(`enum.offerType.${offer.offer_type}`)}</span>
            <span className="doc-id">{t("offer.firstSeen")} {fmtDateShort(offer.first_seen, locale)}</span>
          </p>
        </div>
      </header>

      {/* ---------- anchor nav ---------- */}
      <nav className="offer-anchor-nav" aria-label={t("offer.sectionsAria")}>
        <div className="wrap flex gap-2" style={{ paddingBlock: 0 }}>
          {sections.map((s) => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
        </div>
      </nav>

      <div className="wrap">
        {/* ================= OVERBLIK: promised vs applies ================= */}
        <section id="overblik" className="offer-section">
          <div className="offer-section-head">
            <span className="chapter-no mb-0" style={{ margin: 0 }}>01</span>
            <h2>{t("offer.navOverview")}</h2>
          </div>

          <div className="pva-grid">
            <div className="pva-card" data-side="front">
              <span className="pva-label">{t("offer.promised")}</span>
              <p className="specimen-claim">{headline}</p>
              {advertised ? (
                <p className="specimen-price">
                  {fmtFieldValue(advertised, locale)}
                </p>
              ) : null}
              {supporting && <p className="specimen-support">{supporting}</p>}
              <p className="small muted mt-2">
                {t("offer.claimOriginal")} ({latest.source_language.toUpperCase()}): “{offer.latest.claim_original}”
              </p>
            </div>
            <div className="pva-card" data-side="back">
              <span className="pva-label">{t("offer.applies")}</span>
              <ul className="terms-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {terms.map((term) => (
                  <li key={term.label} style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", padding: "0.55rem 0", borderBottom: "1px solid var(--line)" }}>
                    <span className="term-label muted">{term.label}</span>
                    <span className="term-value" style={{ fontWeight: 600, textAlign: "right" }}>{term.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* version rail */}
          <div className="version-rail" aria-label={t("home.specimenHistory")}>
            <span className="mono muted" style={{ marginRight: "0.6rem" }}>{t("home.specimenHistory")}</span>
            {offer.publishedVersions.map((v, i) => (
              <span key={v.id} className="flex items-center">
                {i > 0 && <span className="version-arrow" aria-hidden="true">→</span>}
                <a className="version-node" href={`#historik`}
                  data-current={v.id === latest.id ? "true" : undefined}
                  data-changed={JSON.parse(v.changed_fields_json).length > 0 ? "true" : undefined}>
                  {versionLabel(v.version)}
                </a>
              </span>
            ))}
          </div>

          {/* recognition */}
          {showRecognition && rec && (
            <div className="paper mt-3" style={{ padding: "1.3rem 1.5rem", borderLeft: "4px solid var(--recognition)" }}>
              <div className="flex items-center flex-wrap gap-2">
                <RecognitionStamp
                  status={rec.status}
                  label={brand.recognitionName}
                  insufficientLabel={t("enum.recognitionStatus.insufficient_documentation")}
                  insufficientBody={t("recognition.insufficientBody")}
                  explainedShort={t("recognition.explainedShort")}
                  openCriteria={t("recognition.openCriteria")}
                  closeLabel={t("common.close")}
                  criteriaTitle={t("recognition.criteriaTitle", { label: brand.recognitionName })}
                  criteriaIntro={t("recognition.criteriaIntro")}
                  notCertification={t("recognition.notCertification")}
                  awardedAtLabel={t("recognition.awardedAt")}
                  awardedAt={fmtDate(rec.decided_at, locale)}
                  versionLabel={t("recognition.appliesToVersion")}
                  versionNo={latest.version}
                  methodLabel={t("recognition.methodVersion")}
                  methodVersion={rec.method_version}
                  sampleLabel={t("recognition.sampleContext")}
                  sampleSize={rec.sample_size}
                  verifiedLabel={t("recognition.verifiedBy")}
                  isVerified={!!rec.verified_by}
                  dimensions={JSON.parse(rec.dimensions_json)}
                  dimensionLabels={Object.fromEntries(
                    ["claim_clarity", "price_clarity", "condition_visibility", "time_clarity", "promise_consistency"]
                      .map((k) => [k, t(`enum.dimension.${k}`)])
                  )}
                  assessmentLabels={Object.fromEntries(
                    ["met", "partially_met", "not_met", "insufficient_data"].map((k) => [k, t(`enum.assessment.${k}`)])
                  )}
                  dimensionIntro={t("recognition.dimensionIntro")}
                  dialogAria={t("a11y.dialogCriteria")}
                />
              </div>
              <p className="small muted mt-1">
                {t("recognition.appliesToVersion")} {versionLabel(latest.version)} · {t("recognition.awardedAt")} {fmtDate(rec.decided_at, locale)} · {t("recognition.methodVersion")} {rec.method_version}
              </p>
            </div>
          )}
          {rec && !rec.verified_by && null /* suggested but not human-verified → not public (§11) */}
        </section>

        {/* ================= BETINGELSER ================= */}
        <section id="betingelser" className="offer-section">
          <div className="offer-section-head">
            <span className="chapter-no" style={{ margin: 0 }}>02</span>
            <h2>{t("offer.conditionsTitle")}</h2>
          </div>
          <p className="deck">{t("offer.conditionsIntro")}</p>
          <div className="paper mt-2" style={{ padding: "0.5rem 1.4rem 1rem" }}>
            {terms.map((term) => {
              const ev = offer.evidence.find((e) => e.field === term.key);
              return (
                <div key={term.key} className="obs-line" style={{ alignItems: "center" }}>
                  <span className="obs-text muted" style={{ flex: 1 }}>{term.label}</span>
                  <strong style={{ marginRight: "0.5rem" }}>{term.value}</strong>
                  {ev && <a className="doc-id" href={`#${ev.id}`}>{ev.evidence_ref}</a>}
                </div>
              );
            })}
          </div>
        </section>

        {/* ================= EVIDENS ================= */}
        <section id="evidens" className="offer-section">
          <div className="offer-section-head">
            <span className="chapter-no" style={{ margin: 0 }}>03</span>
            <h2><FileMagnifyingGlass size={26} weight="duotone" style={{ verticalAlign: -4, marginRight: 10, color: "var(--primary)" }} aria-hidden="true" />{t("offer.evidenceTitle")}</h2>
          </div>
          <p className="deck">{t("offer.evidenceIntro")}</p>
          <div className="stack mt-3" style={{ maxWidth: "48rem" }}>
            {offer.evidence.map((e, i) => (
              <figure key={e.id} id={e.id} className="evidence-card" style={{ margin: 0 }}>
                <figcaption className="flex justify-between flex-wrap gap-1">
                  <span className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{e.evidence_ref}</span>
                  <span className="mono muted">{t("offer.evidenceFor")}: {t(`field.${e.field}`)}</span>
                </figcaption>
                <blockquote className="evidence-quote">“{e.evidence_span}”</blockquote>
                <span className="small muted">
                  {t("offer.sourceNote", { company: offer.company_name, date: fmtDateShort(latest.observed_at, locale) })}
                </span>
              </figure>
            ))}
          </div>
        </section>

        {/* ================= COMMUNITY ================= */}
        <section id="community" className="offer-section">
          <div className="offer-section-head">
            <span className="chapter-no" style={{ margin: 0 }}>04</span>
            <h2><UsersThree size={26} weight="duotone" style={{ verticalAlign: -4, marginRight: 10, color: "var(--primary)" }} aria-hidden="true" />{t("offer.communityTitle")}</h2>
          </div>
          <p className="deck">{t("offer.communityIntro")}</p>
          <div className="grid-2 mt-2" style={{ alignItems: "start" }}>
            <div className="paper" style={{ padding: "1.2rem 1.5rem" }}>
              <CommunitySummaryView
                summary={offer.summary}
                locale={locale}
                noObservations={t("community.noObservations")}
                receiversLabel={t("community.receiversAssessed", { count: offer.summary.sample_size })}
              />
            </div>
            <div className="paper-soft" style={{ padding: "1.2rem 1.5rem" }}>
              <strong>{t("offer.communityCta")}</strong>
              <p className="small muted">{t("reviews.queueIntro")}</p>
              {user ? (
                <Link href="/vurderinger" className="btn">{t("offer.communityCtaBtn")}</Link>
              ) : (
                <Link href={`/konto?next=${encodeURIComponent(`/tilbud/${offer.offer_id}`)}`} className="btn">{t("offer.communityCtaBtn")}</Link>
              )}
            </div>
          </div>
        </section>

        {/* ================= HISTORIK ================= */}
        <section id="historik" className="offer-section">
          <div className="offer-section-head">
            <span className="chapter-no" style={{ margin: 0 }}>05</span>
            <h2><ClockCounterClockwise size={26} weight="duotone" style={{ verticalAlign: -4, marginRight: 10, color: "var(--primary)" }} aria-hidden="true" />{t("offer.historyTitle")}</h2>
          </div>
          <p className="deck">
            {offer.publishedVersions.length > 1
              ? t("offer.historyIntro", { count: offer.publishedVersions.length })
              : t("offer.historySingle")}
          </p>

          <div className="stack mt-3" style={{ maxWidth: "52rem" }}>
            {[...offer.publishedVersions].reverse().map((v) => {
              const vChanges = offer.changes.filter((c) => c.successor_version_id === v.id);
              const vFields = JSON.parse(v.fields_json) as Record<string, unknown>;
              return (
                <article key={v.id} className="history-sheet" data-current={v.id === latest.id ? "true" : undefined}>
                  <div className="history-sheet-head">
                    <span className="flex gap-1 items-center flex-wrap">
                      <span className="doc-id" style={{ borderColor: v.id === latest.id ? "var(--ink)" : undefined }}>
                        {offerVersionLabel(v.version)}
                      </span>
                      <span className="mono muted">{fmtDate(v.observed_at, locale)}</span>
                      {v.published_at && (
                        <span className="mono muted">{t("offer.publishedNote", { date: fmtDateShort(v.published_at, locale) })}</span>
                      )}
                    </span>
                    {v.verified_at && (
                      <span className="mono muted">{t("offer.verifiedNote", { date: fmtDateShort(v.verified_at, locale) })}</span>
                    )}
                  </div>
                  <p className="display" style={{ fontSize: "1.2rem", fontWeight: 650, margin: "0.2rem 0 0.6rem" }}>
                    {v.claim_original}
                  </p>
                  {vChanges.length > 0 ? (
                    <div className="stack">
                      {vChanges.map((c) => {
                        const prev = offer.publishedVersions.find((p) => p.id === v.predecessor_version_id);
                        return (
                          <DiffBlock
                            key={c.id}
                            fieldLabel={t(`field.${c.field}`)}
                            oldValue={JSON.parse(c.old_value_json)}
                            newValue={JSON.parse(c.new_value_json)}
                            locale={locale}
                            changeLabel={t("offer.changeLabel")}
                            fromVersion={prev?.version}
                            toVersion={v.version}
                            changedAt={fmtDateShort(c.changed_at, locale)}
                            evidenceRef={c.evidence_ref}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="small muted mb-0">
                      {t("common.observed")}: {fmtNumber(Object.keys(vFields).length, locale)} {t("common.conditions").toLowerCase()} · {versionLabel(v.version)}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}


