import type { Metadata } from "next";
import { getLocale, makeT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: makeT(locale)("privacy.title") };
}

/** Privacy boundary (§13 MASTER / §21 BUILD SPEC) — validation-stage notice. */
export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = makeT(locale);

  return (
    <div className="wrap section" style={{ paddingTop: "clamp(2rem,5vw,3.5rem)", maxWidth: "48rem" }}>
      <h1>{t("privacy.title")}</h1>
      <p className="deck mt-1">{t("privacy.intro")}</p>

      <section className="mt-4" aria-label={t("privacy.privateTitle")}>
        <span className="chapter-no">01</span>
        <h2>{t("privacy.privateTitle")}</h2>
        <p className="mt-1">{t("privacy.privateBody")}</p>
        <ul className="mt-1" style={{ maxWidth: "38em" }}>
          {["privacy.item1", "privacy.item2", "privacy.item3", "privacy.item4", "privacy.item5"].map((k) => (
            <li key={k} className="muted">{t(k)}</li>
          ))}
        </ul>
      </section>

      <section className="section" style={{ paddingBlock: "clamp(2rem,4vw,3rem)" }} aria-label={t("privacy.publicTitle")}>
        <span className="chapter-no">02</span>
        <h2>{t("privacy.publicTitle")}</h2>
        <p className="mt-1">{t("privacy.publicBody")}</p>
      </section>

      <section aria-label={t("privacy.noLegal")}>
        <span className="chapter-no">03</span>
        <h2>{t("methodology.noLegalTitle")}</h2>
        <p className="mt-1">{t("privacy.noLegal")} {t("methodology.noLegalBody")}</p>
        <div className="notice mt-2" data-tone="attention">
          {t("privacy.validationNotice")}
        </div>
      </section>
    </div>
  );
}
