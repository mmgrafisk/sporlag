import Link from "next/link";
import { getLocale, makeT } from "@/lib/i18n";
import { q1 } from "@/lib/db";
import { fmtNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const locale = await getLocale();
  const t = makeT(locale);

  const counts = q1<Record<string, number>>(
    `SELECT
      (SELECT COUNT(*) FROM newsletter_sources) AS sources,
      (SELECT COUNT(*) FROM messages) AS messages,
      (SELECT COUNT(*) FROM messages WHERE state IN ('RECEIVED','EXTRACTED','NEEDS_REVIEW','LOW_CONFIDENCE','POSSIBLE_UPDATE')) AS review_queue,
      (SELECT COUNT(*) FROM offer_versions WHERE verification_status='verified' AND publication_status='unpublished') AS ready_publish,
      (SELECT COUNT(*) FROM offer_versions WHERE publication_status='published') AS published,
      (SELECT COUNT(*) FROM recognitions WHERE verified_by IS NULL) AS recognition_pending,
      (SELECT COUNT(*) FROM company_suggestions WHERE status='pending') AS suggestions,
      (SELECT COUNT(*) FROM human_corrections) AS corrections`
  ) ?? {};

  const cards: [string, string, number | undefined][] = [
    [t("admin.navSources"), "/admin/kilder", counts.sources],
    [t("admin.navMessages"), "/admin/beskeder", counts.messages],
    [t("studio.queueTitle"), "/studie", counts.review_queue],
    [t("admin.navPublish"), "/admin/publicering", counts.ready_publish],
    [t("admin.navRecognition"), "/admin/anerkendelse", counts.recognition_pending],
    [t("admin.navSuggestions"), "/admin/foresla", counts.suggestions],
    [t("admin.navAudit"), "/admin/audit", counts.corrections],
    [t("admin.navConfig"), "/admin/konfiguration", undefined],
  ];

  return (
    <div>
      <h1 className="mb-1">{t("admin.title")}</h1>
      <p className="deck">{t("admin.intro")}</p>
      <div className="grid-2 mt-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))" }}>
        {cards.map(([label, href, count]) => (
          <Link key={href} href={href} className="paper" style={{
            padding: "1.3rem 1.4rem", textDecoration: "none", color: "var(--ink)",
            display: "block",
          }}>
            <span className="display" style={{ fontSize: "2rem", fontWeight: 700, display: "block" }}>
              {count !== undefined ? fmtNumber(count, locale) : "—"}
            </span>
            <span className="small muted">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
