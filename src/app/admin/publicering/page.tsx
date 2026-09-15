import Link from "next/link";
import { getLocale, makeT } from "@/lib/i18n";
import { versionsReadyForPublication } from "@/lib/queries";
import { fmtDateShort, versionLabel } from "@/lib/format";
import PostButton from "@/components/PostButton";

export const dynamic = "force-dynamic";

/** Publication control (§7): verification ≠ publication; explicit transition. */
export default async function PublishAdminPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const ready = versionsReadyForPublication();

  return (
    <div>
      <h1 className="mb-1">{t("admin.publishTitle")}</h1>
      <p className="deck">{t("admin.publishIntro")}</p>

      <div className="data-table-wrap mt-3">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t("common.company")}</th>
              <th>{t("common.offer")}</th>
              <th>{t("common.version")}</th>
              <th>{t("offer.changedFields")}</th>
              <th>{t("common.observed")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ready.map((v) => {
              const changed = JSON.parse(v.changed_fields_json) as string[];
              return (
                <tr key={v.id}>
                  <td className="mono">{v.id}</td>
                  <td><Link href={`/virksomheder/${v.company_slug}`}>{v.company_name}</Link></td>
                  <td className="small">{v.claim_original}</td>
                  <td className="mono">{versionLabel(v.version)}</td>
                  <td className="small">{changed.map((c) => t(`field.${c}`)).join(", ") || "—"}</td>
                  <td className="small nowrap">{fmtDateShort(v.observed_at, locale)}</td>
                  <td>
                    <PostButton
                      endpoint={`/api/internal/offer-versions/${v.id}/publish`}
                      label={t("admin.publishBtn")}
                      variant="btn-ink"
                      small
                      successLabel={t("admin.publishDone")}
                      failureLabel={t("admin.formError")}
                    />
                  </td>
                </tr>
              );
            })}
            {ready.length === 0 && (
              <tr><td colSpan={7} className="muted">{t("admin.publishNone")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
