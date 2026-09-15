import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { makeT } from "@/lib/i18n";
import { fmtDateShort, versionLabel } from "@/lib/format";
import { termsFromFields } from "@/lib/display";
import type { PublicOfferRow } from "@/lib/queries";
import CompanyMark from "@/components/CompanyMark";
import {
  ArrowRight,
  ClockCounterClockwise,
  FileText,
  LinkSimple,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Homepage evidence specimen.
 *
 * The visual grammar follows DESIGN_BRAND §2/§4: promise → conditions → history.
 * It deliberately avoids browser chrome, glassmorphism and decorative gradients.
 */
export default function HeroWindow(props: { offers: PublicOfferRow[]; locale: Locale }) {
  const t = makeT(props.locale);
  const active = props.offers[0] ?? null;
  if (!active) return null;

  const terms = termsFromFields(active.fields, props.locale).slice(0, 5);
  const headline =
    (active.fields["headline"] as { text?: string } | undefined)?.text ?? active.claim_original;
  const firstVersion = versionLabel(Math.max(1, active.version - active.total_versions + 1));
  const currentVersion = versionLabel(active.version);

  return (
    <div className="hero-visual hero-evidence" aria-label={headline}>
      <div className="evidence-stack">
        <article className="evidence-sheet evidence-sheet-front">
          <header className="evidence-sheet-head">
            <span>{t("home.specimenFront")}</span>
            <span className="mono">{currentVersion}</span>
          </header>

          <div className="evidence-sheet-body">
            <div className="evidence-company-row">
              <CompanyMark
                name={active.company_name}
                slug={active.company_slug}
                size={42}
                src={active.company_logo_path}
              />
              <div>
                <strong>{active.company_name}</strong>
                <span>{active.category ? t(`enum.category.${active.category}`) : t(`enum.offerType.${active.offer_type}`)}</span>
              </div>
            </div>

            <p className="evidence-claim">{headline}</p>
            <p className="evidence-observed mono">
              {t("common.observed")} · {fmtDateShort(active.observed_at, props.locale)}
            </p>

            <Link href={`/tilbud/${active.offer_id}`} className="evidence-link">
              {t("home.windowDetails")} <ArrowRight size={15} weight="bold" />
            </Link>
          </div>
        </article>

        <article className="evidence-sheet evidence-sheet-back">
          <header className="evidence-sheet-head">
            <span>{t("home.specimenBack")}</span>
            <FileText size={17} aria-hidden="true" />
          </header>

          <dl className="evidence-terms">
            {terms.map((term) => (
              <div key={term.key}>
                <dt>{term.label}</dt>
                <dd>{term.value}</dd>
              </div>
            ))}
            <div>
              <dt>{t("home.windowSource")}</dt>
              <dd className="evidence-source">
                <LinkSimple size={14} aria-hidden="true" /> {t("home.windowSourceValue")}
              </dd>
            </div>
          </dl>
        </article>

        <aside className="evidence-history-sheet">
          <div className="evidence-history-head">
            <span>{t("home.specimenHistory")}</span>
            <ClockCounterClockwise size={17} aria-hidden="true" />
          </div>
          <div className="evidence-history-rail" aria-label={t("common.history")}>
            <span>{firstVersion}</span>
            <i aria-hidden="true">→</i>
            <strong>{currentVersion}</strong>
          </div>
          <p>
            {active.total_versions} {t("common.versions").toLowerCase()}
            {active.changed_fields.length > 0 ? ` · ${active.changed_fields.length} ${t("offer.changedFields").toLowerCase()}` : ""}
          </p>
          <Link href={`/tilbud/${active.offer_id}#historik`} className="evidence-link">
            {t("common.history")} <ArrowRight size={15} weight="bold" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
