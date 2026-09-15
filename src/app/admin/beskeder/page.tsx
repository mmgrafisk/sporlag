import Link from "next/link";
import { getLocale, makeT } from "@/lib/i18n";
import { listMessages, sourceRegistry } from "@/lib/queries";
import { fmtDateShort } from "@/lib/format";
import ActionForm from "@/components/ActionForm";

export const dynamic = "force-dynamic";

/** Incoming messages + safe ingestion (§8/§27). */
export default async function MessagesAdminPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const messages = listMessages({ limit: 100 });
  const sources = sourceRegistry();

  return (
    <div>
      <h1 className="mb-1">{t("admin.messagesTitle")}</h1>

      <div className="grid-2 mt-2" style={{ alignItems: "start" }}>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("studio.subjectLabel")}</th>
                <th>{t("studio.colSource")}</th>
                <th>{t("studio.colReceived")}</th>
                <th>{t("studio.colState")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.id}</td>
                  <td className="small">{m.subject_private}</td>
                  <td className="small">{m.company_name}</td>
                  <td className="small nowrap">{fmtDateShort(m.received_at, locale)}</td>
                  <td><span className="state-pill" data-state={m.state}>{t(`enum.messageState.${m.state}`)}</span></td>
                  <td><Link className="btn btn-quiet btn-sm" href={`/studie/beskeder/${m.id}`}>{t("studio.openBtn")}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ActionForm
          endpoint="/api/internal/messages"
          wide
          title={t("admin.ingestTitle")}
          intro={t("admin.ingestIntro")}
          submitLabel={t("admin.ingestBtn")}
          successLabel={t("admin.ingestDone")}
          errorLabel={t("admin.formError")}
          fields={[
            {
              name: "source_id", label: t("admin.ingestSource"), type: "select", required: true,
              options: sources.map((s) => ({ value: s.id, label: `${s.company_name} — ${s.alias_email}` })),
            },
            { name: "subject", label: t("admin.ingestSubject"), required: true },
            {
              name: "raw_html", label: t("admin.ingestHtml"), type: "textarea", required: true,
              hint: t("studio.privateNotice"),
            },
          ]}
        />
      </div>
    </div>
  );
}
