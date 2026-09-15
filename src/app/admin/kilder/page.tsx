import { getLocale, makeT } from "@/lib/i18n";
import { sourceRegistry } from "@/lib/queries";
import { q } from "@/lib/db";
import { fmtDateShort } from "@/lib/format";
import ActionForm from "@/components/ActionForm";

export const dynamic = "force-dynamic";

/** Source Registry (§8): platform-owned legitimate newsletter subscriptions. */
export default async function SourcesAdminPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const sources = sourceRegistry();
  const companies = q<{ id: string; name: string }>(
    `SELECT id, name FROM companies WHERE status = 'active' ORDER BY name COLLATE NOCASE`
  );

  return (
    <div>
      <h1 className="mb-1">{t("admin.sourcesTitle")}</h1>
      <p className="deck">{t("admin.sourcesIntro")}</p>

      <div className="grid-2 mt-3" style={{ alignItems: "start" }}>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("common.company")}</th>
                <th>{t("admin.sourceName")}</th>
                <th>{t("admin.sourceAlias")}</th>
                <th>{t("admin.sourceLanguage")}</th>
                <th>{t("common.status")}</th>
                <th>{t("admin.navMessages")}</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.id}</td>
                  <td>{s.company_name}</td>
                  <td>{s.name}</td>
                  <td className="mono small">{s.alias_email}</td>
                  <td className="mono">{s.language.toUpperCase()}</td>
                  <td><span className="state-pill" data-state={s.status === "active" ? "VERIFIED" : undefined}>{s.status}</span></td>
                  <td className="mono">{s.message_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ActionForm
          endpoint="/api/internal/newsletter-sources"
          title={t("admin.registerSource")}
          intro={t("admin.sourcesIntro")}
          submitLabel={t("admin.registerSource")}
          successLabel={t("admin.sourceRegistered")}
          errorLabel={t("admin.formError")}
          fields={[
            {
              name: "company_id", label: t("admin.sourceCompany"), type: "select", required: true,
              options: companies.map((c) => ({ value: c.id, label: c.name })),
            },
            { name: "name", label: t("admin.sourceName"), required: true },
            {
              name: "alias_email", label: t("admin.sourceAlias"), type: "email", required: true,
              hint: "fx telmore@inbox.platform.local",
            },
            {
              name: "language", label: t("admin.sourceLanguage"), type: "select", defaultValue: "da",
              options: [{ value: "da", label: "da" }, { value: "en", label: "en" }],
            },
            {
              name: "source_confidence", label: t("admin.sourceConfidence"), type: "select", defaultValue: "direct_subscription",
              options: [
                { value: "direct_subscription", label: "direct_subscription" },
                { value: "public_signup", label: "public_signup" },
              ],
            },
          ]}
        />
      </div>
      <p className="mono muted small mt-2">{fmtDateShort(new Date().toISOString(), locale)}</p>
    </div>
  );
}
