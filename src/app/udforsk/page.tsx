import { getLocale, makeT } from "@/lib/i18n";
import { listPublishedOffers, listCompanies } from "@/lib/queries";
import OfferEntry from "@/components/OfferEntry";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: makeT(locale)("explore.title") };
}

const OFFER_TYPES = [
  "subscription_discount", "one_time_purchase", "bundle", "free_trial",
  "gift_with_purchase", "loyalty_offer", "other",
];

/** Explore Offers — the public record, as editorial entries (not card spam). */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; type?: string; changed?: string }>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = makeT(locale);
  const offers = listPublishedOffers({
    companySlug: sp.company || undefined,
    offerType: sp.type || undefined,
    changedOnly: sp.changed === "1",
  });
  const companies = listCompanies().filter((c) => c.published_offers > 0);

  return (
    <div className="wrap section" style={{ paddingTop: "clamp(2rem,5vw,3.5rem)" }}>
      <span className="chapter-no">01</span>
      <h1>{t("explore.title")}</h1>
      <p className="deck mt-1">{t("explore.intro")}</p>

      {/* Filters: plain GET form — works without JS, keyboard friendly */}
      <form method="get" action="/udforsk" className="flex gap-2 flex-wrap items-center mt-3 mb-3"
        style={{ borderTop: "2px solid var(--ink)", borderBottom: "1px solid var(--line)", paddingBlock: "1rem" }}>
        <label className="mono muted" htmlFor="f-company">{t("explore.filterCompany")}</label>
        <select id="f-company" name="company" className="select" style={{ width: "auto", minHeight: 44 }} defaultValue={sp.company ?? ""}>
          <option value="">{t("common.all")}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>

        <label className="mono muted" htmlFor="f-type">{t("explore.filterType")}</label>
        <select id="f-type" name="type" className="select" style={{ width: "auto", minHeight: 44 }} defaultValue={sp.type ?? ""}>
          <option value="">{t("common.all")}</option>
          {OFFER_TYPES.map((ty) => (
            <option key={ty} value={ty}>{t(`enum.offerType.${ty}`)}</option>
          ))}
        </select>

        <label className="flex items-center gap-1" style={{ minHeight: 44 }}>
          <input type="checkbox" name="changed" value="1" defaultChecked={sp.changed === "1"}
            style={{ width: 20, height: 20, accentColor: "var(--primary)" }} />
          <span className="small">{t("explore.filterChanged")}</span>
        </label>

        <button type="submit" className="btn btn-quiet btn-sm">{t("common.search")}</button>
        <span className="mono muted" style={{ marginLeft: "auto" }}>
          {t("explore.resultsCount", { count: offers.length })}
        </span>
      </form>

      {offers.length === 0 ? (
        <p className="muted">{t("explore.noResults")}</p>
      ) : (
        <div>
          {offers.map((o) => <OfferEntry key={o.offer_id} row={o} locale={locale} />)}
        </div>
      )}
    </div>
  );
}
