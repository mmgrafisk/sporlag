import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { makeT } from "@/lib/i18n";
import { fmtFieldValue } from "@/lib/format";
import { termsFromFields } from "@/lib/display";
import type { PublicOfferRow } from "@/lib/queries";
import CompanyMark from "@/components/CompanyMark";
import {
  ArrowRight, Gift, Lock, Coins, CalendarBlank, User, Paperclip, CheckCircle,
} from "@phosphor-icons/react/dist/ssr";

const ROW_ICON: Record<string, typeof Coins> = {
  advertised_price: Coins,
  normal_price: Coins,
  minimum_purchase: Coins,
  deposit: Lock,
  intro_period: CalendarBlank,
  expiry: CalendarBlank,
  binding_period: CalendarBlank,
  new_customers: User,
  wager_requirement: Lock,
  discount: Gift,
};

function inboxWhen(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const loc = locale === "da-DK" ? "da-DK" : "en-GB";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - day.getTime()) / 86400000);
  if (diff <= 0) {
    return d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  }
  if (diff === 1) return locale === "da-DK" ? "I går" : "Yesterday";
  return d.toLocaleDateString(loc, { weekday: "short" });
}

export default function HeroWindow(props: { offers: PublicOfferRow[]; locale: Locale }) {
  const t = makeT(props.locale);
  const list = props.offers.slice(0, 6);
  const active = list[0];
  if (!active) return null;
  const terms = termsFromFields(active.fields, props.locale).slice(0, 6);
  const headline =
    (active.fields["headline"] as { text?: string } | undefined)?.text ?? active.claim_original;

  return (
    <div className="hero-visual">
      <div className="hero-blobs" aria-hidden="true" />
      <div className="product-window">
        <div className="pw-chrome">
          <i /><i /><i />
        </div>
        <div className="pw-body">
          <aside className="pw-inbox">
            <p className="pw-pane-label">{t("home.windowInbox")}</p>
            <ul>
              {list.map((o, i) => (
                <li key={o.offer_id} data-active={i === 0 ? "true" : undefined}>
                  <Link href={`/tilbud/${o.offer_id}`}>
                    <CompanyMark name={o.company_name} slug={o.company_slug} size={32} src={o.company_logo_path} />
                    <span className="pw-inbox-copy">
                      <strong>{o.company_name}</strong>
                      <em>{o.claim_original}</em>
                    </span>
                    <time>{inboxWhen(o.observed_at, props.locale)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>

          <div className="pw-bridge" aria-hidden="true">
            <span className="pw-extract">{t("home.windowExtract")}</span>
          </div>

          <section className="pw-detail">
            <header className="pw-detail-head">
              <CompanyMark name={active.company_name} slug={active.company_slug} size={48} src={active.company_logo_path} />
              <div>
                <strong>{active.company_name}</strong>
                <em>{active.category ? t(`enum.category.${active.category}`) : t(`enum.offerType.${active.offer_type}`)}</em>
              </div>
              <span className="pw-filled"><CheckCircle size={16} weight="fill" /> {t("home.windowFilled")}</span>
            </header>
            <p className="pw-claim">
              <Gift size={22} weight="fill" /> {headline}
            </p>
            <dl className="pw-fields">
              {terms.map((term) => {
                const Icon = ROW_ICON[term.key] ?? Paperclip;
                return (
                  <div key={term.key}>
                    <dt><Icon size={18} weight="duotone" /> {term.label}</dt>
                    <dd>{term.value}</dd>
                  </div>
                );
              })}
              <div>
                <dt><Paperclip size={15} /> {t("home.windowSource")}</dt>
                <dd>{t("home.windowSourceValue")}</dd>
              </div>
            </dl>
            <Link href={`/tilbud/${active.offer_id}`} className="pw-more">
              {t("home.windowDetails")} <ArrowRight size={14} weight="bold" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
