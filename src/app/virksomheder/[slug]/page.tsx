import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, makeT } from "@/lib/i18n";
import { getCompanyProfile, isSourceSelected } from "@/lib/queries";
import { currentUser } from "@/lib/auth";
import { fmtDateShort, fmtNumber, fmtPercent } from "@/lib/format";
import NewsletterSelectButton from "@/components/NewsletterSelectButton";
import DiffBlock from "@/components/DiffBlock";
import OfferEntry from "@/components/OfferEntry";
import CompanyMark from "@/components/CompanyMark";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const company = getCompanyProfile(slug);
  return { title: company ? company.name : makeT(locale)("company.notFound") };
}

/**
 * COMPANY PROFILE (§16 DESIGN): clarity dimensions with sample sizes —
 * deliberately NO single dominant trust score (§3/§19 MASTER).
 */
export default async function CompanyProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = makeT(locale);
  const user = await currentUser();
  const profile = getCompanyProfile(slug);
  if (!profile) notFound();

  const primarySource = profile.sources[0] ?? null;
  const selected = user && primarySource ? isSourceSelected(user.id, primarySource.id) : false;

  const totalDimAnswers = profile.clarity.reduce((acc, d) => acc + d.count, 0);

  return (
    <>
      <header className="offer-hero">
        <div className="wrap">
          <p className="small muted"><Link href="/virksomheder">{t("company.title")}</Link></p>
          <div className="company-profile-head">
            <CompanyMark name={profile.name} slug={profile.slug} size={72} src={profile.logo_path} />
            <h1>{profile.name}</h1>
          </div>
          <p className="flex gap-1 flex-wrap items-center mt-2">
            {profile.category && <span className="doc-id">{profile.category.toUpperCase()}</span>}
            <span className="doc-id">{profile.market}</span>
            <span className="doc-id">{fmtNumber(profile.stats.offers, locale)} {t("company.profileOffers").toLowerCase()}</span>
            <span className="doc-id">{fmtNumber(profile.stats.versions, locale)} {t("common.versions").toLowerCase()}</span>
            <span className="doc-id">{fmtNumber(profile.stats.observations, locale)} {t("company.profileConfirmations").toLowerCase()}</span>
          </p>
          <div className="mt-3 flex gap-2 flex-wrap items-center">
            {primarySource && (
              <NewsletterSelectButton
                sourceId={primarySource.id}
                selected={selected}
                isLoggedIn={!!user}
                labels={{
                  receive: t("company.ctaReceive"),
                  receiving: t("company.ctaReceiving"),
                  stop: t("company.ctaStop"),
                  loginFirst: t("account.requireLogin"),
                }}
              />
            )}
          </div>
          <p className="notice small mt-2" style={{ maxWidth: "40rem" }}>{t("company.noScoreNote")}</p>
        </div>
      </header>

      <div className="wrap">
        {/* clarity dimensions */}
        <section className="offer-section" aria-labelledby="clarity-h">
          <div className="offer-section-head">
            <span className="chapter-no" style={{ margin: 0 }}>01</span>
            <h2 id="clarity-h">{t("company.clarityTitle")}</h2>
          </div>
          <p className="deck">{t("company.clarityIntro")}</p>
          <div className="paper mt-2" style={{ padding: "0.6rem 1.5rem 1.2rem", maxWidth: "48rem" }}>
            {profile.clarity.map((d) => (
              <div key={d.key}>
                <div className="dim-row">
                  <span className="dim-label">{t(`company.dim.${d.key}`)}</span>
                  <span className="dim-count">
                    {d.percent !== null ? fmtPercent(d.percent, locale) : "—"} · n={fmtNumber(d.count, locale)}
                  </span>
                  <span className="dim-bar" aria-hidden="true">
                    <span className="dim-fill" style={{ width: `${d.percent ?? 0}%`, display: "block" }} />
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="small muted mt-1">
            {t("community.sampleLine", { count: fmtNumber(totalDimAnswers, locale) })}
          </p>
        </section>

        {/* recent offers */}
        <section className="offer-section" aria-labelledby="offers-h">
          <div className="offer-section-head">
            <span className="chapter-no" style={{ margin: 0 }}>02</span>
            <h2 id="offers-h">{t("company.recentOffers")}</h2>
          </div>
          {profile.offers.length === 0 ? (
            <p className="muted">{t("explore.noResults")}</p>
          ) : (
            <div>{profile.offers.map((o) => <OfferEntry key={o.offer_id} row={o} locale={locale} />)}</div>
          )}
        </section>

        {/* recent changes */}
        <section className="offer-section" aria-labelledby="changes-h">
          <div className="offer-section-head">
            <span className="chapter-no" style={{ margin: 0 }}>03</span>
            <h2 id="changes-h">{t("company.recentChanges")}</h2>
          </div>
          {profile.changes.length === 0 ? (
            <p className="muted">—</p>
          ) : (
            <div className="grid-2">
              {profile.changes.map((c, i) => (
                <div key={i}>
                  <p className="small mb-1">
                    <Link href={`/tilbud/${c.offer_id}`} style={{ fontWeight: 600 }}>{c.claim_original}</Link>{" "}
                    <span className="mono muted">v{String(c.version).padStart(2, "0")}</span>
                  </p>
                  <DiffBlock
                    fieldLabel={t(`field.${c.field}`)}
                    oldValue={c.old_value}
                    newValue={c.new_value}
                    locale={locale}
                    changeLabel={t("offer.changeLabel")}
                    toVersion={c.version}
                    changedAt={fmtDateShort(c.changed_at, locale)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* source coverage */}
        <section className="offer-section" aria-labelledby="coverage-h">
          <div className="offer-section-head">
            <span className="chapter-no" style={{ margin: 0 }}>04</span>
            <h2 id="coverage-h">{t("company.coverage")}</h2>
          </div>
          <p className="deck">{t("company.coverageNote")}</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, maxWidth: "48rem" }}>
            {profile.sources.map((s) => (
              <li key={s.id} className="obs-line">
                <span className="obs-text" style={{ flex: 1 }}>
                  {s.name} <span className="mono muted">· {s.language.toUpperCase()}</span>
                </span>
                <span className="doc-id">{s.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
