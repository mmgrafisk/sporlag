import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, makeT } from "@/lib/i18n";
import { pulseIssues, platformStats } from "@/lib/queries";
import { fmtDate, fmtNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: makeT(locale)("pulse.title") };
}

type BlockContent = { headline: string; body: string; offer_id?: string | null };

/**
 * MARKET PULSE (§20 DESIGN / §12 MASTER): a monthly editorial publication —
 * page-like rhythm, strong typography, methodology and sample size visible.
 * Not a KPI dashboard.
 */
export default async function PulsePage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const issues = pulseIssues();
  const stats = platformStats();
  const latest = issues[0] ?? null;
  const allBlocks = latest
    ? (JSON.parse(latest.blocks_json) as Record<string, Record<string, BlockContent>>)
    : null;
  const localeBlocks = allBlocks
    ? (allBlocks[locale === "da-DK" ? "da" : "en"] ?? allBlocks["da"])
    : null;

  const blockOrder: { key: string; labelKey: string }[] = [
    { key: "clearest", labelKey: "pulse.block.clearest" },
    { key: "improvements", labelKey: "pulse.block.improvements" },
    { key: "declines", labelKey: "pulse.block.declines" },
    { key: "patterns", labelKey: "pulse.block.patterns" },
    { key: "newBrands", labelKey: "pulse.block.newBrands" },
    { key: "changed", labelKey: "pulse.block.changed" },
  ];

  return (
    <div className="section" style={{ paddingTop: "clamp(2rem,5vw,3.5rem)" }}>
      <div className="wrap">
        <span className="chapter-no">{locale === "da-DK" ? "MÅNEDLIG PUBLIKATION" : "MONTHLY PUBLICATION"}</span>
        <h1>{t("pulse.title")}</h1>
        <p className="deck mt-1">{t("pulse.intro")}</p>
      </div>

      {latest ? (
        <article className="wrap pulse-issue mt-4">
          <header style={{ borderTop: "3px double var(--line-strong)", borderBottom: "1px solid var(--line)", paddingBlock: "2rem 1.5rem" }}>
            <p className="mono" style={{ color: "var(--oxide)" }}>{latest.period}</p>
            <h2 style={{ fontSize: "clamp(2rem,4.5vw,3rem)" }}>{latest.title}</h2>
            <p className="pulse-standfirst mt-1">{latest.standfirst}</p>
            <p className="mono muted mt-2">
              {t("pulse.sampleNote", {
                count: fmtNumber(stats.published_versions, locale),
                obs: fmtNumber(stats.observations, locale),
              })}
            </p>
          </header>

          {localeBlocks && blockOrder.map((b, i) => {
            const content = localeBlocks[b.key];
            if (!content) return null;
            return (
              <section key={b.key} className="pulse-block">
                <span className="pulse-block-no">{String(i + 1).padStart(2, "0")} {t(b.labelKey).toUpperCase()}</span>
                <h3>{content.headline}</h3>
                <p style={{ maxWidth: "38em", color: "var(--muted-ink)" }}>{content.body}</p>
                {content.offer_id && (
                  <p>
                    <Link className="btn btn-quiet btn-sm" href={`/tilbud/${content.offer_id}`}>
                      {t("common.readMore")}
                    </Link>
                  </p>
                )}
              </section>
            );
          })}

          <footer className="pulse-block">
            <span className="pulse-block-no">{t("pulse.methodologyNote").toUpperCase()}</span>
            <p className="small muted" style={{ maxWidth: "42em" }}>{latest.methodology}</p>
            <p className="small muted">
              {t("common.sampleSize")}: {fmtNumber(latest.sample_size, locale)} · {t("common.timestamp")}: {fmtDate(latest.published_at, locale)}
            </p>
            <p className="small mt-2"><Link href="/metodologi">{t("common.methodology")} →</Link></p>
          </footer>
        </article>
      ) : (
        <div className="wrap"><p className="muted mt-4">{t("pulse.noIssues")}</p></div>
      )}

      {issues.length > 1 && (
        <div className="wrap mt-4">
          <h2 className="mb-2" style={{ fontSize: "1.3rem" }}>{t("pulse.issues")}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {issues.slice(1).map((iss) => (
              <li key={iss.id} className="obs-line">
                <span className="mono muted">{iss.period}</span>
                <span className="obs-text">{iss.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
