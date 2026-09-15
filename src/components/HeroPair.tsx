import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { makeT } from "@/lib/i18n";
import { fmtFieldValue } from "@/lib/format";
import { termsFromFields } from "@/lib/display";
import type { PublicOfferRow } from "@/lib/queries";
import CompanyMark from "@/components/CompanyMark";
import { ArrowRight, Clock, User, Prohibit, CalendarBlank, Coins } from "@phosphor-icons/react/dist/ssr";

const ICONS: Record<string, typeof Clock> = {
  new_customers: User,
  advertised_price: Coins,
  intro_period: Clock,
  binding_period: Clock,
  normal_price: Coins,
  expiry: CalendarBlank,
  exclusions: Prohibit,
};

export default function HeroPair(props: {
  offer: PublicOfferRow;
  locale: Locale;
  landscapeCaption: string;
  brandName: string;
}) {
  const t = makeT(props.locale);
  const o = props.offer;
  const fields = o.fields;
  const terms = termsFromFields(fields, props.locale).slice(0, 5);
  const price = fields["advertised_price"];

  return (
    <div className="hero-visual">
      <img src="/hero-coast.jpg" alt="" className="hero-photo" />
      <p className="hero-landscape-caption">{props.landscapeCaption}</p>
      <span className="hero-est">{props.brandName} · EST. 2026</span>

      <div className="hero-pair">
        <p className="pair-note">{t("home.pairNote")}</p>

        <article className="pair-card pair-front">
          <div className="pair-co">
            <CompanyMark name={o.company_name} slug={o.company_slug} size={34} />
            <span>
              <strong>{o.company_name}</strong>
              {o.category ? <em>{t(`enum.category.${o.category}`)}</em> : null}
            </span>
          </div>
          <h3>{o.claim_original}</h3>
          {price ? <p className="pair-price">{fmtFieldValue(price, props.locale)}</p> : null}
          {terms[0] && (
            <p className="pair-chip">
              <Clock size={14} weight="bold" /> {terms[0].value}
            </p>
          )}
          <Link href={`/tilbud/${o.offer_id}`} className="pair-link">
            {t("home.pairSeeOffer")} <ArrowRight size={14} weight="bold" />
          </Link>
        </article>

        <article className="pair-card pair-back">
          <div className="pair-tabs" aria-hidden="true">
            <span>{t("home.specimenFront")}</span>
            <span data-on="true">{t("home.specimenBack")}</span>
          </div>
          <ul>
            {terms.map((term) => {
              const Icon = ICONS[term.key] ?? Clock;
              return (
                <li key={term.key}>
                  <Icon size={15} weight="regular" />
                  <span>{term.value}</span>
                </li>
              );
            })}
          </ul>
          <Link href={`/tilbud/${o.offer_id}#betingelser`} className="pair-link">
            {t("home.pairSeeTerms")} <ArrowRight size={14} weight="bold" />
          </Link>
        </article>
      </div>
    </div>
  );
}
