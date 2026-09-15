import { getLocale, makeT } from "@/lib/i18n";
import { auditTrail } from "@/lib/queries";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Audit trail (§27): every editorial change and publication is logged. */
export default async function AuditAdminPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const rows = auditTrail(300);

  return (
    <div>
      <h1 className="mb-1">{t("admin.auditTitle")}</h1>
      <p className="deck">{t("admin.auditIntro")}</p>

      <div className="data-table-wrap mt-3">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("common.timestamp")}</th>
              <th>Action</th>
              <th>Entity</th>
              <th>{t("studio.colSource")}</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="small nowrap">{fmtDate(a.created_at, locale)}</td>
                <td className="mono small">{a.action}</td>
                <td className="mono small">{a.entity_type} · {a.entity_id}</td>
                <td className="small">{a.actor_name ?? "system"}</td>
                <td className="small muted" style={{ maxWidth: "24rem", wordBreak: "break-word" }}>{a.detail_json}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
