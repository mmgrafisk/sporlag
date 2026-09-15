import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { makeT } from "@/lib/i18n";
import { fmtDateShort, fmtFieldValue, versionLabel } from "@/lib/format";
import type { PublicOfferRow } from "@/lib/queries";
import { ArrowsLeftRight } from "@phosphor-icons/react/dist/ssr";

/** Editorial offer list row — an entry in the record, not a SaaS card. */
export default function OfferEntry(props: { row: PublicOfferRow; locale: Locale }) {
  const t = makeT(props.locale);
  const o = props.row;
  const fields = JSON.parse(o.fields_json) as Record<string, unknown>;
  const changed = JSON.parse(o.changed_fields_json) as string[];
  const price = fields["advertised_price"];

  return (
    <article className="offer-entry">
      <div className="offer-entry-side">
        <Link href={`/virksomheder/${o.company_slug}`} className="mono" style={{ color: "var(--ink)", fontWeight: 600 }}>
          {o.company_name}
        </Link>
        <span className="doc-id">{versionLabel(o.version)} · {o.offer_id}</span>
        {changed.length > 0 && (
          <span className="badge-changed"><ArrowsLeftRight size={11} weight="bold" /> {t("explore.changedBadge")}</span>
        )}
      </div>
      <div>
        <Link href={`/tilbud/${o.offer_id}`} className="offer-entry-title">{o.claim_original}</Link>
        <p className="offer-entry-meta">
          {t(`enum.offerType.${o.offer_type}`)} · {t("common.observed")} {fmtDateShort(o.observed_at, props.locale)} ·{" "}
          {t("explore.versionCount", { count: o.total_versions })}
          {o.recognition_status === "clearly_documented" && o.recognition_verified ? (
            <> · <span style={{ color: "var(--recognition)", fontWeight: 600 }}>{t("enum.recognitionStatus.clearly_documented")}</span></>
          ) : null}
        </p>
        {changed.length > 0 && (
          <p className="small muted">{t("offer.changedFields")}: {changed.map((c) => t(`field.${c}`)).join(", ")}</p>
        )}
      </div>
      <div className="offer-entry-price">
        {price ? fmtFieldValue(price, props.locale) : "—"}
      </div>
    </article>
  );
}
