import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, makeT } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { reviewQueue } from "@/lib/queries";
import { fmtDateShort, versionLabel } from "@/lib/format";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: makeT(locale)("reviews.queueTitle") };
}

/** Review Queue — concrete campaigns from newsletters the user receives. */
export default async function ReviewQueuePage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const user = await currentUser();
  if (!user) redirect(`/konto?next=${encodeURIComponent("/vurderinger")}`);

  const queue = reviewQueue(user.id);

  return (
    <div className="wrap section" style={{ paddingTop: "clamp(2rem,5vw,3.5rem)", maxWidth: "52rem" }}>
      <span className="chapter-no">01</span>
      <h1>{t("reviews.queueTitle")}</h1>
      <p className="deck mt-1">{t("reviews.queueIntro")}</p>

      {queue.length === 0 ? (
        <div className="mt-4">
          <p className="muted">{t("reviews.empty")}</p>
          <Link href="/mine-nyhedsbreve" className="btn btn-ghost mt-1">{t("reviews.findMore")}</Link>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: "2rem 0 0", padding: 0 }}>
          {queue.map((r) => (
            <li key={r.task_id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1.2rem",
              padding: "1.2rem 0", borderBottom: "1px solid var(--line)", flexWrap: "wrap",
            }}>
              <span>
                <span className="mono muted">
                  <Link href={`/virksomheder/${r.company_slug}`} style={{ color: "inherit" }}>{r.company_name}</Link>
                  {" · "}{versionLabel(r.version)} · {t("reviews.taskObserved")} {fmtDateShort(r.observed_at, locale)}
                </span>
                <span className="display" style={{ display: "block", fontSize: "1.15rem", fontWeight: 650, marginTop: "0.25rem" }}>
                  {r.claim_original}
                </span>
              </span>
              <Link href={`/vurderinger/${r.task_id}`} className="btn">
                {t("reviews.startBtn")} <ArrowRight size={15} weight="bold" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
