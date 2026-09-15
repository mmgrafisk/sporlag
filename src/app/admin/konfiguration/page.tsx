import { getLocale, makeT } from "@/lib/i18n";
import { getBrand } from "@/lib/brand";
import ActionForm from "@/components/ActionForm";
import PostButton from "@/components/PostButton";

export const dynamic = "force-dynamic";

/** Brand & config (§24/§26): rebrandable without schema migration. */
export default async function ConfigAdminPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const brand = getBrand();

  return (
    <div>
      <h1 className="mb-1">{t("admin.configTitle")}</h1>
      <p className="deck">{t("admin.configIntro", { name: brand.name })}</p>

      <div className="grid-2 mt-3" style={{ alignItems: "start" }}>
        <ActionForm
          endpoint="/api/internal/brand-config"
          title={t("admin.configTitle")}
          submitLabel={t("common.save")}
          successLabel={t("admin.configSaved")}
          errorLabel={t("admin.formError")}
          fields={[
            { name: "brand.name", label: t("admin.configName"), defaultValue: brand.name, required: true },
            { name: "brand.tagline", label: t("admin.configTagline"), defaultValue: brand.tagline, required: true },
            { name: "brand.recognitionName", label: t("admin.configRecognition"), defaultValue: brand.recognitionName, required: true },
            { name: "brand.publicUrl", label: t("admin.configUrl"), defaultValue: brand.publicUrl },
            { name: "brand.emailSender", label: t("admin.configSender"), defaultValue: brand.emailSender },
            { name: "brand.logo", label: t("admin.configLogo"), defaultValue: brand.logo, hint: "layers" },
          ]}
        />

        <div className="paper-soft" style={{ padding: "1.4rem 1.5rem" }}>
          <h2 style={{ fontSize: "1.2rem" }}>{t("admin.seedTitle")}</h2>
          <p className="small muted">{t("admin.seedIntro")}</p>
          <PostButton
            endpoint="/api/internal/dev-seed"
            body={{}}
            label={t("admin.seedBtn")}
            variant="btn-ink"
            successLabel={t("admin.seedDone")}
            failureLabel={t("admin.formError")}
          />
          <p className="mono muted small mt-2">
            {t("common.workingName", { name: brand.name })}
          </p>
        </div>
      </div>
    </div>
  );
}
