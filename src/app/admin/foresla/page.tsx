import { getLocale, makeT } from "@/lib/i18n";
import { companySuggestions } from "@/lib/queries";
import { fmtDate } from "@/lib/format";
import PostButton from "@/components/PostButton";

export const dynamic = "force-dynamic";

/** Moderation of missing-company suggestions (§15): never auto-published. */
export default async function SuggestionsAdminPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const pending = companySuggestions("pending");
  const handled = companySuggestions("approved").concat(companySuggestions("rejected"), companySuggestions("duplicate"));

  const row = (s: { id: string; company_name: string; note: string | null; status: string; created_at: string; user_name: string | null }, withActions: boolean) => (
    <tr key={s.id}>
      <td>{s.company_name}</td>
      <td className="small muted">{s.note ?? "—"}</td>
      <td className="small">{s.user_name ?? "—"}</td>
      <td className="small nowrap">{fmtDate(s.created_at, locale)}</td>
      <td><span className="state-pill" data-state={s.status === "approved" ? "VERIFIED" : undefined}>{s.status}</span></td>
      <td>
        {withActions && (
          <div className="flex gap-1 flex-wrap">
            <PostButton endpoint={`/api/internal/company-suggestions/${s.id}/moderate`}
              body={{ action: "approve" }} label={t("admin.suggestApprove")} variant="btn-ink" small
              successLabel={t("admin.formSuccess")} failureLabel={t("admin.formError")} />
            <PostButton endpoint={`/api/internal/company-suggestions/${s.id}/moderate`}
              body={{ action: "duplicate" }} label={t("admin.suggestDupe")} variant="btn-quiet" small
              successLabel={t("admin.formSuccess")} failureLabel={t("admin.formError")} />
            <PostButton endpoint={`/api/internal/company-suggestions/${s.id}/moderate`}
              body={{ action: "reject" }} label={t("admin.suggestReject")} variant="btn-danger" small
              successLabel={t("admin.formSuccess")} failureLabel={t("admin.formError")} />
          </div>
        )}
      </td>
    </tr>
  );

  const head = (
    <thead>
      <tr>
        <th>{t("common.company")}</th>
        <th>{t("newsletters.suggestNote")}</th>
        <th>{t("studio.colSource")}</th>
        <th>{t("common.timestamp")}</th>
        <th>{t("common.status")}</th>
        <th></th>
      </tr>
    </thead>
  );

  return (
    <div>
      <h1 className="mb-1">{t("admin.suggestionsTitle")}</h1>
      <p className="deck">{t("admin.suggestionsIntro")}</p>

      <div className="data-table-wrap mt-3">
        <table className="data-table">
          {head}
          <tbody>
            {pending.map((s) => row(s, true))}
            {pending.length === 0 && <tr><td colSpan={6} className="muted">{t("admin.suggestionsNone")}</td></tr>}
          </tbody>
        </table>
      </div>

      {handled.length > 0 && (
        <>
          <h2 className="mt-4 mb-1" style={{ fontSize: "1.2rem" }}>{t("common.status")}</h2>
          <div className="data-table-wrap">
            <table className="data-table">
              {head}
              <tbody>{handled.map((s) => row(s, false))}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
