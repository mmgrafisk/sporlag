import Link from "next/link";
import { getLocale, makeT } from "@/lib/i18n";
import { listPublishedOffers, platformStats, pulseIssues, listCompanies } from "@/lib/queries";
import { fmtNumber } from "@/lib/format";
import HeroWindow from "@/components/HeroWindow";
import OfferCard from "@/components/OfferCard";
import CompanyMark from "@/components/CompanyMark";
import {
  ArrowRight, EnvelopeSimple, ListChecks, PencilSimpleLine, ShareNetwork,
  MagnifyingGlass, ChartLineUp, CalendarBlank, Buildings, UsersThree,
  Stack, FileText, ClockCounterClockwise,
} from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const stats = platformStats();
  const offers = listPublishedOffers({ limit: 8 });
  const companies = listCompanies().filter((c) => c.published_offers > 0).slice(0, 6);
  const heroOffer = offers[0] ?? null;
  const latestPulse = pulseIssues()[0] ?? null;

  return (
    <>
      <section className="hero-stage">
        <div className="wrap-wide hero-split">
          <div className="hero-copy">
            <span className="kicker">{t("home.categoryLine")}</span>
            <h1 className="hero-title">{t("home.heroTitle")}</h1>
            <p className="deck">{t("home.heroSupport")}</p>
            <ul className="hero-triad">
              <li><Stack size={28} weight="duotone" /> {t("home.specimenFront")}</li>
              <li><FileText size={28} weight="duotone" /> {t("home.specimenBack")}</li>
              <li><ClockCounterClockwise size={28} weight="duotone" /> {t("home.specimenHistory")}</li>
            </ul>
            <div className="hero-cta">
              <Link href="/udforsk" className="btn">{t("home.ctaPrimary")} <ArrowRight size={18} weight="bold" /></Link>
              <Link href="#saadan" className="btn btn-quiet">{t("home.ctaSecondary")}</Link>
            </div>
            <dl className="hero-stats">
              <div>
                <dt>{fmtNumber(stats.published_offers, locale)}</dt>
                <dd>{t("home.statsOffers")}</dd>
              </div>
              <div>
                <dt>{fmtNumber(stats.companies, locale)}</dt>
                <dd>{t("home.statsCompanies")}</dd>
              </div>
              <div>
                <dt>{fmtNumber(stats.observations, locale)}</dt>
                <dd>{t("home.statsCommunity")}</dd>
              </div>
            </dl>
          </div>
          {heroOffer && <HeroWindow offers={offers} locale={locale} />}
        </div>
      </section>

      <section className="home-search-band">
        <div className="wrap-wide">
          <form className="market-search" method="get" action="/udforsk" role="search">
            <MagnifyingGlass size={22} weight="bold" />
            <input
              className="input"
              type="search"
              name="q"
              placeholder={t("home.searchPlaceholder")}
              aria-label={t("home.searchPlaceholder")}
            />
            <button type="submit" className="btn btn-sm">{t("common.search")}</button>
          </form>
          {companies.length > 0 && (
            <p className="popular-row">
              <span className="muted">{t("home.popular")}</span>
              {companies.map((c) => (
                <Link key={c.id} href={`/virksomheder/${c.slug}`} className="chip chip-logo">
                  <CompanyMark name={c.name} slug={c.slug} size={22} src={c.logo_path} />
                  {c.name}
                </Link>
              ))}
            </p>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: "2.5rem" }}>
        <div className="wrap-wide home-market">
          <div>
            <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
              <h2 className="home-h2">{t("home.newOffers")}</h2>
              <Link href="/udforsk" className="text-link">{t("home.allOffers")} <ArrowRight size={16} weight="bold" /></Link>
            </div>
            <div className="offer-grid">
              {offers.slice(0, 4).map((o) => (
                <OfferCard key={o.offer_id} row={o} locale={locale} />
              ))}
            </div>
          </div>
          <aside className="home-aside">
            <div className="pulse-panel">
              <div className="flex justify-between items-center">
                <span className="pulse-panel-kicker"><ChartLineUp size={22} weight="bold" /> {t("home.pulseTeaserTitle")}</span>
                <Link href="/markedspulsen" className="icon-btn" aria-label={t("home.pulseTeaserCta")}><ArrowRight size={18} weight="bold" /></Link>
              </div>
              <p className="small mt-1">{latestPulse ? latestPulse.standfirst : t("home.pulseNow")}</p>
              <ul className="pulse-metrics">
                <li><CalendarBlank size={20} weight="duotone" /> <strong>{fmtNumber(stats.published_versions, locale)}</strong> {t("home.statsVersions")}</li>
                <li><Buildings size={20} weight="duotone" /> <strong>{fmtNumber(stats.companies, locale)}</strong> {t("home.statsCompanies")}</li>
                <li><UsersThree size={20} weight="duotone" /> <strong>{fmtNumber(stats.observations, locale)}</strong> {t("home.statsCommunity")}</li>
              </ul>
              <Link href="/markedspulsen" className="text-link">{t("home.pulseTeaserCta")} <ArrowRight size={16} /></Link>
            </div>
            <div className="community-panel">
              <UsersThree size={40} weight="duotone" />
              <h3>{t("home.communityTitle")}</h3>
              <p className="small muted">{t("home.communityBody")}</p>
              <Link href="/mine-nyhedsbreve" className="btn btn-sm">{t("home.ctaNewsletters")}</Link>
            </div>
          </aside>
        </div>
      </section>

      <section id="saadan" className="how-band">
        <div className="wrap-wide how-row">
          {[
            { icon: <EnvelopeSimple size={34} weight="duotone" />, title: t("home.how1Title"), body: t("home.how1Body") },
            { icon: <ListChecks size={34} weight="duotone" />, title: t("home.how2Title"), body: t("home.how2Body") },
            { icon: <PencilSimpleLine size={34} weight="duotone" />, title: t("home.how3Title"), body: t("home.how3Body") },
            { icon: <ShareNetwork size={34} weight="duotone" />, title: t("home.how4Title"), body: t("home.how4Body") },
          ].map((s) => (
            <article key={s.title} className="how-step">
              <span className="how-icon" aria-hidden="true">{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="quote-band">
        <div className="wrap quote-band-inner">
          <blockquote>{t("home.quote")}</blockquote>
          <Link href="/metodologi" className="btn btn-quiet">{t("home.quoteCta")} <ArrowRight size={16} weight="bold" /></Link>
        </div>
      </section>
    </>
  );
}
