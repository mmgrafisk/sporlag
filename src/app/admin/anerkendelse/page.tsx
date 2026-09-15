import Link from "next/link";
import { getLocale, makeT } from "@/lib/i18n";
import { getBrand } from "@/lib/brand";
import { recognitionCandidates } from "@/lib/queries";
import { fmtDate, versionLabel } from "@/lib/format";
import PostButton from "@/components/PostButton";

export const dynamic = "force-dynamic";

/** Recognition administration (§19): engine suggests → human verifies. */
export default async function RecognitionAdminPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const brand = getBrand();
  const rows = recognitionCandidates();

  return (
    <div>
      <h1 className="mb-1">{t("admin.recognitionTitle")}</h1>
      <p className="deck">{t("admin.recognitionIntro")}</p>

      <div className="flex gap-2 mt-2">
        <PostButton
          endpoint="/api/internal/recognition/suggest"
          body={{}}
          label={t("admin.recognitionSuggest")}
          successLabel={t("admin.formSuccess")}
          failureLabel={t("admin.formError")}
        />
      </div>

      <div className="data-table-wrap mt-3">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("common.company")}</th>
              <th>{t("common.offer")}</th>
              <th>{t("common.version")}</th>
              <th>{t("common.status")}</th>
              <th>{t("common.sampleSize")}</th>
              <th>{t("common.method")}</th>
              <th>{t("recognition.awardedAt")}</th>
              <th>{t("recognition.verifiedBy")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/virksomheder/${r.company_slug}`}>{r.company_name}</Link></td>
                <td className="small"><Link href={`/tilbud/${r.offer_id}`}>{r.claim_original}</Link></td>
                <td className="mono">{versionLabel(r.version)}</td>
                <td>
                  <span className="state-pill" data-state={r.status === "clearly_documented" ? "VERIFIED" : undefined}>
                    {r.status === "clearly_documented" ? brand.recognitionName : t("enum.recognitionStatus.insufficient_documentation")}
                  </span>
                </td>
                <td className="mono">{r.sample_size}</td>
                <td className="mono small">{r.method_version}</td>
                <td className="small nowrap">{fmtDate(r.decided_at, locale)}</td>
                <td className="small">{r.verified_by ? "✓" : "—"}</td>
                <td>
                  {!r.verified_by && (
                    <PostButton
                      endpoint={`/api/internal/recognition/${r.id}/verify`}
                      label={t("admin.recognitionVerify")}
                      variant="btn-quiet"
                      small
                      successLabel={t("admin.recognitionVerified")}
                      failureLabel={t("admin.formError")}
                    />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="muted">{t("admin.recognitionNone")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
