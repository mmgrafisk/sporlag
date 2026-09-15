import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, makeT } from "@/lib/i18n";
import { currentUser, EDITORIAL_ROLES } from "@/lib/auth";
import { listMessages } from "@/lib/queries";
import { fmtDateShort } from "@/lib/format";
import { MESSAGE_STATES } from "@/lib/versioning";
import PostButton from "@/components/PostButton";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: makeT(locale)("studio.title") };
}

/** Review Studio queue (§10): messages by state, dense professional list. */
export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = makeT(locale);
  const user = await currentUser();
  if (!user) redirect(`/konto?next=${encodeURIComponent("/studie")}`);
  if (!EDITORIAL_ROLES.includes(user.role)) {
    return (
      <div className="wrap section">
        <div className="notice" data-tone="error">{t("auth.errForbidden")}</div>
      </div>
    );
  }

  const messages = listMessages({ state: sp.state || undefined });

  return (
    <div className="wrap-wide section" style={{ paddingTop: "clamp(1.5rem,4vw,2.5rem)" }}>
      <span className="mono" style={{ color: "var(--oxide)" }}>INTERNAL · EDITORIAL</span>
      <h1 className="mt-1" style={{ fontSize: "clamp(1.9rem,3.5vw,2.6rem)" }}>{t("studio.title")}</h1>
      <p className="deck">{t("studio.intro")}</p>

      {/* state filter tabs */}
      <nav className="flex gap-1 flex-wrap mt-3 mb-3" aria-label={t("studio.queueTitle")}>
        <Link href="/studie" className="chip" data-on={!sp.state ? "true" : undefined}>{t("studio.filterAll")}</Link>
        {MESSAGE_STATES.map((s) => (
          <Link key={s} href={`/studie?state=${s}`} className="chip" data-on={sp.state === s ? "true" : undefined}>
            {t(`enum.messageState.${s}`)}
          </Link>
        ))}
      </nav>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("studio.colMessage")}</th>
              <th>{t("studio.colSource")}</th>
              <th>{t("studio.colReceived")}</th>
              <th>{t("studio.colState")}</th>
              <th>{t("studio.colOffers")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id}>
                <td>
                  <span className="mono">{m.id}</span>
                  <div className="small">{m.subject_private}</div>
                </td>
                <td>
                  <Link href={`/virksomheder/${m.company_slug}`}>{m.company_name}</Link>
                  <div className="small muted">{m.source_name}</div>
                </td>
                <td className="small nowrap">{fmtDateShort(m.received_at, locale)}</td>
                <td><span className="state-pill" data-state={m.state}>{t(`enum.messageState.${m.state}`)}</span></td>
                <td className="mono">{m.candidate_count}</td>
                <td>
                  <div className="flex gap-1">
                    <Link className="btn btn-sm" href={`/studie/beskeder/${m.id}`}>{t("studio.openBtn")}</Link>
                    {m.state === "RECEIVED" && (
                      <PostButton
                        endpoint={`/api/internal/messages/${m.id}/extract`}
                        label={t("studio.extractBtn")}
                        variant="btn-quiet"
                        small
                        successLabel={t("studio.extracted")}
                        failureLabel={t("studio.opFailed")}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {messages.length === 0 && (
              <tr><td colSpan={6} className="muted">—</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
