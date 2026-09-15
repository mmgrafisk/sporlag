import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, makeT } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { contributionProfile, userObservationCount } from "@/lib/queries";
import { fmtNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: makeT(locale)("contributions.title") };
}

/**
 * Contributor profile (§19 DESIGN / §18 BUILD SPEC):
 * points / reputation / impact shown SEPARATELY. No leaderboards in v1.
 */
export default async function ContributionsPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const user = await currentUser();
  if (!user) redirect(`/konto?next=${encodeURIComponent("/bidrag")}`);

  const profile = contributionProfile(user.id);
  const reviews = userObservationCount(user.id);

  return (
    <div className="wrap section" style={{ paddingTop: "clamp(2rem,5vw,3.5rem)", maxWidth: "56rem" }}>
      <span className="chapter-no">01</span>
      <h1>{t("contributions.title")}</h1>
      <p className="deck mt-1">{t("contributions.intro")}</p>

      <div className="contrib-figures mt-4">
        <div className="contrib-figure">
          <div className="num">{fmtNumber(profile.contribution_points, locale)}</div>
          <div className="lbl">{t("contributions.points")}</div>
          <div className="desc">{t("contributions.pointsDesc")}</div>
        </div>
        <div className="contrib-figure">
          <div className="num">{fmtNumber(profile.reputation, locale)}</div>
          <div className="lbl">{t("contributions.reputation")}</div>
          <div className="desc">{t("contributions.reputationDesc")}</div>
        </div>
        <div className="contrib-figure">
          <div className="num">{fmtNumber(profile.impact_count, locale)}</div>
          <div className="lbl">{t("contributions.impact")}</div>
          <div className="desc">{t("contributions.impactDesc")}</div>
        </div>
      </div>

      <p className="mono muted mt-3">
        {fmtNumber(reviews, locale)} {t("reviews.queueTitle").toLowerCase()} · {user.name} · {t(`enum.role.${user.role}`)}
      </p>
      <div className="notice mt-3" data-tone="recognition">{t("contributions.noGamification")}</div>
    </div>
  );
}
