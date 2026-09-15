import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, makeT } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { reviewQueue, userSelections, contributionProfile } from "@/lib/queries";
import { fmtDateShort, fmtNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: makeT(locale)("dashboard.title") };
}

/** Dashboard / Mit overblik — calm personal start page. */
export default async function DashboardPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const user = await currentUser();
  if (!user) redirect(`/konto?next=${encodeURIComponent("/mit-overblik")}`);

  const queue = reviewQueue(user.id);
  const selections = userSelections(user.id);
  const profile = contributionProfile(user.id);

  return (
    <div className="wrap section" style={{ paddingTop: "clamp(2rem,5vw,3.5rem)" }}>
      <span className="chapter-no">01</span>
      <h1>{t("dashboard.greeting", { name: user.name })}</h1>

      <div className="grid-2 mt-4" style={{ alignItems: "start" }}>
        {/* queue */}
        <section className="paper" style={{ padding: "1.5rem 1.7rem" }} aria-labelledby="q-h">
          <h2 id="q-h" style={{ fontSize: "1.25rem" }}>{t("dashboard.queueTitle")}</h2>
          {queue.length === 0 ? (
            <p className="muted small mt-1">{t("dashboard.queueEmpty")}</p>
          ) : (
            <>
              <p className="display mt-1" style={{ fontSize: "2.4rem", fontWeight: 700, color: "var(--primary)" }}>
                {t("dashboard.queueCount", { count: queue.length })}
              </p>
              <ul style={{ listStyle: "none", margin: "0.6rem 0 0", padding: 0 }}>
                {queue.slice(0, 3).map((r) => (
                  <li key={r.task_id} className="obs-line">
                    <span className="obs-text" style={{ flex: 1 }}>
                      <strong>{r.company_name}</strong> · {r.claim_original}
                    </span>
                    <span className="mono muted">{fmtDateShort(r.observed_at, locale)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/vurderinger" className="btn mt-2">{t("dashboard.queueBtn")}</Link>
            </>
          )}
        </section>

        {/* newsletters */}
        <section className="paper" style={{ padding: "1.5rem 1.7rem" }} aria-labelledby="n-h">
          <h2 id="n-h" style={{ fontSize: "1.25rem" }}>{t("dashboard.newslettersTitle")}</h2>
          <p className="display mt-1" style={{ fontSize: "2.4rem", fontWeight: 700, color: "var(--primary)" }}>
            {t("dashboard.newslettersCount", { count: selections.length })}
          </p>
          <Link href="/mine-nyhedsbreve" className="btn btn-ghost mt-1">{t("dashboard.newslettersBtn")}</Link>
        </section>
      </div>

      {/* contribution figures — separate (§18) */}
      <section className="mt-4" aria-labelledby="c-h">
        <h2 id="c-h" style={{ fontSize: "1.25rem" }} className="mb-2">{t("dashboard.contribTitle")}</h2>
        <div className="contrib-figures">
          <div className="contrib-figure">
            <div className="num">{fmtNumber(profile.contribution_points, locale)}</div>
            <div className="lbl">{t("contributions.points")}</div>
          </div>
          <div className="contrib-figure">
            <div className="num">{fmtNumber(profile.reputation, locale)}</div>
            <div className="lbl">{t("contributions.reputation")}</div>
          </div>
          <div className="contrib-figure">
            <div className="num">{fmtNumber(profile.impact_count, locale)}</div>
            <div className="lbl">{t("contributions.impact")}</div>
          </div>
        </div>
        <Link href="/bidrag" className="btn btn-quiet btn-sm mt-2">{t("common.readMore")}</Link>
      </section>
    </div>
  );
}
