import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { makeT } from "@/lib/i18n";
import { fmtFieldValue } from "@/lib/format";
import type { PublicOfferRow } from "@/lib/queries";
import CompanyMark from "@/components/CompanyMark";
import { ArrowRight, CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";

function seenLabel(iso: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - day.getTime()) / 86400000);
  if (diff <= 0) return t("common.seenToday");
  if (diff === 1) return t("common.seenYesterday");
  return t("common.seenDays", { n: diff });
}

function verifiedClarity(row: PublicOfferRow): "clear" | "caution" | null {
  if (!row.recognition_verified) return null;
  if (row.recognition_status === "clearly_documented") return "clear";
  if (row.recognition_status === "insufficient_documentation") return "caution";
  return null;
}

export default function OfferCard(props: { row: PublicOfferRow; locale: Locale }) {
  const t = makeT(props.locale);
  const o = props.row;
  const price = o.fields["advertised_price"];
  const intro = o.fields["intro_period"];
  const clarity = verifiedClarity(o);
  const ClarityIcon = clarity === "clear" ? CheckCircle : WarningCircle;

  return (
    <Link href={`/tilbud/${o.offer_id}`} className="offer-card">
      <div className="offer-card-top">
        <span className="offer-card-co">
          <CompanyMark name={o.company_name} slug={o.company_slug} size={44} src={o.company_logo_path} />
          <span>
            <strong>{o.company_name}</strong>
            {o.category ? <em>{t(`enum.category.${o.category}`)}</em> : null}
          </span>
        </span>
      </div>
      <h3>{o.claim_original}</h3>
      <p className="offer-card-support">
        {price ? fmtFieldValue(price, props.locale) : intro ? fmtFieldValue(intro, props.locale) : t(`enum.offerType.${o.offer_type}`)}
      </p>
      {(clarity || o.observation_users > 0) && (
        <div className="offer-card-pills">
          {clarity && (
            <span className="clarity-pill" data-tone={clarity}>
              <ClarityIcon size={14} weight="fill" />
              {t(`offer.clarity.${clarity}`)}
            </span>
          )}
          {o.observation_users > 0 && (
            <span className="clarity-pill" data-tone="neutral">
              {t("offer.confirmations", { count: o.observation_users })}
            </span>
          )}
        </div>
      )}
      <div className="offer-card-foot">
        <span>{seenLabel(o.observed_at, t)}</span>
        <span className="offer-card-go" aria-hidden="true">
          <ArrowRight size={16} weight="bold" />
        </span>
      </div>
    </Link>
  );
}
