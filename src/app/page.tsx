import Link from "next/link";
import { getLocale, makeT } from "@/lib/i18n";
import { getBrand } from "@/lib/brand";
import { listPublishedOffers, platformStats, recentPublishedChanges, pulseIssues } from "@/lib/queries";
import { termsFromFields } from "@/lib/display";
import { fmtDateShort, fmtFieldValue, fmtNumber, versionLabel } from "@/lib/format";
import Specimen from "@/components/Specimen";
import DiffBlock from "@/components/DiffBlock";
import { Stack, Eye, ClockCounterClockwise, ArrowRight } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const brand = getBrand();
  const stats = platformStats();
  const offers = listPublishedOffers({ limit: 4 });
  const changes = recentPublishedChanges(4);
  const heroOffer = offers[0] ?? null;
  const heroFields = heroOffer ? (JSON.parse(heroOffer.fields_json) as Record<string, unknown>) : {};
  const latestPulse = pulseIssues()[0] ?? null;

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="hero">
        <div className="wrap-wide hero-grid">
          <div>
            <span className="mono" style={{ color: "var(--oxide)" }}>
              {t("home.categoryLine")}
            </span>
            <h1 className="hero-title mt-1">
              {t("home.heroTitle").split("\n")[0]}{" "}
              <span className="hero-mark">{t("home.heroTitle").split("\n")[1]}</span>
            </h1>
            <p className="deck">{t("home.heroSupport")}</p>
            <div className="hero-cta">
              <Link href="/udforsk" className="btn">{t("home.ctaPrimary")} <ArrowRight size={17} weight="bold" /></Link>
              <Link href="/mine-nyhedsbreve" className="btn btn-ghost">{t("home.ctaSecondary")}</Link>
            </div>
            <p className="small muted mt-2" style={{ maxWidth: "30rem" }}>{t("common.privateSource")}</p>
          </div>

          {/* Hero visual: a real layered offer specimen — front (promise) / back (terms) */}
          {heroOffer && (
            <Specimen
              frontLabel={t("home.specimenFront")}
              backLabel={t("home.specimenBack")}
              historyLabel={t("home.specimenHistory")}
              revealLabel={t("home.specimenReveal")}
              collapseLabel={t("home.specimenCollapse")}
              docId={t("offer.documentId", { id: `${versionLabel(heroOffer.version)} · ${heroOffer.company_slug}` })}
              company={heroOffer.company_name}
              observed={`${t("common.observed")} ${fmtDateShort(heroOffer.observed_at, locale)}`}
              claim={heroOffer.claim_original}
              price={heroFields["advertised_price"] ? fmtFieldValue(heroFields["advertised_price"], locale) : undefined}
              support={(heroFields["supporting_claim"] as { text?: string } | undefined)?.text ?? null}
              terms={termsFromFields(heroFields, locale)}
              versions={Array.from({ length: heroOffer.total_versions }, (_, i) => ({
                n: i + 1,
                href: `/tilbud/${heroOffer.offer_id}#historik`,
                current: i + 1 === heroOffer.version,
                changed: i + 1 === heroOffer.version && JSON.parse(heroOffer.changed_fields_json).length > 0,
              }))}
            />
          )}
        </div>
      </section>

      {/* ================= stats strip — restrained, mono ================= */}
      <section aria-label="status">
        <div className="wrap-wide">
          <hr className="rule-ink" />
          <div className="flex flex-wrap" style={{ justifyContent: "space-between", gap: "1.5rem", paddingBlock: "1.1rem" }}>
            {[
              [fmtNumber(stats.published_offers, locale), t("home.statsOffers")],
              [fmtNumber(stats.published_versions, locale), t("home.statsVersions")],
              [fmtNumber(stats.changes, locale), t("home.statsChanges")],
              [fmtNumber(stats.observations, locale), t("home.statsCommunity")],
            ].map(([num, label]) => (
              <span key={label} className="mono muted">
                <strong style={{ color: "var(--ink)", fontSize: "1rem" }}>{num}</strong> {label}
              </span>
            ))}
          </div>
          <hr className="rule-ink" />
        </div>
      </section>

      {/* ================= the three layers ================= */}
      <section className="section">
        <div className="wrap">
          <span className="chapter-no">01</span>
          <h2>{t("home.layersTitle")}</h2>
          <p className="deck mt-1">{t("home.layersIntro")}</p>
          <div className="layers mt-4">
            {[
              { icon: <Stack size={30} weight="duotone" />, no: t("home.specimenFront"), title: t("home.layerFrontTitle"), body: t("home.layerFrontBody") },
              { icon: <Eye size={30} weight="duotone" />, no: t("home.specimenBack"), title: t("home.layerBackTitle"), body: t("home.layerBackBody") },
              { icon: <ClockCounterClockwise size={30} weight="duotone" />, no: t("home.specimenHistory"), title: t("home.layerHistoryTitle"), body: t("home.layerHistoryBody") },
            ].map((layer) => (
              <article className="layer" key={layer.no}>
                <span className="layer-icon" aria-hidden="true">{layer.icon}</span>
                <span className="mono" style={{ color: "var(--oxide)" }}>{layer.no}</span>
                <h3 className="mt-1">{layer.title}</h3>
                <p>{layer.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================= changed since last time (real diffs) ================= */}
      <section className="section" style={{ background: "var(--paper)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <span className="chapter-no">02</span>
          <div className="flex justify-between items-center flex-wrap gap-2 mb-3">
            <h2>{t("home.changedTitle")}</h2>
            <Link href="/udforsk?changed=1" className="btn btn-quiet btn-sm">{t("explore.title")} <ArrowRight size={14} weight="bold" /></Link>
          </div>
          <p className="deck">{t("home.changedIntro")}</p>
          {changes.length === 0 && <p className="muted mt-3">—</p>}
          <div className="grid-2 mt-3">
            {changes.map((c, i) => (
              <div key={c.id ?? i}>
                <p className="small mb-1">
                  <Link href={`/virksomheder/${c.company_slug}`} style={{ fontWeight: 650 }}>{c.company_name}</Link>{" "}
                  <span className="muted">· <Link href={`/tilbud/${c.offer_id}`}>{c.claim_original}</Link></span>
                </p>
                <DiffBlock
                  fieldLabel={t(`field.${c.field}`)}
                  oldValue={JSON.parse(c.old_value_json)}
                  newValue={JSON.parse(c.new_value_json)}
                  locale={locale}
                  changeLabel={t("offer.changeLabel")}
                  toVersion={c.version}
                  changedAt={fmtDateShort(c.changed_at, locale)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= recognition + pulse teasers (asymmetric) ================= */}
      <section className="section">
        <div className="wrap grid-asym">
          <div>
            <span className="chapter-no">03</span>
            <h2>{t("home.recognitionTeaserTitle")}</h2>
            <p className="deck mt-1">{t("home.recognitionTeaserBody", { label: brand.recognitionName })}</p>
            <p className="mt-2">
              <span className="stamp">{brand.recognitionName}</span>
            </p>
            <Link href="/metodologi" className="btn btn-ghost btn-sm mt-2">{t("home.recognitionTeaserCta")} <ArrowRight size={14} weight="bold" /></Link>
          </div>
          <div className="paper-soft" style={{ padding: "clamp(1.4rem,3vw,2.2rem)" }}>
            <span className="mono muted">{t("home.pulseTeaserTitle")}</span>
            <h3 className="mt-1">{latestPulse ? latestPulse.title : t("pulse.title")}</h3>
            <p className="muted small">{latestPulse ? latestPulse.standfirst : t("home.pulseTeaserBody")}</p>
            <Link href="/markedspulsen" className="btn btn-quiet btn-sm">{t("home.pulseTeaserCta")} <ArrowRight size={14} weight="bold" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
