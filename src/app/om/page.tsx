import type { Metadata } from "next";
import { getLocale, makeT } from "@/lib/i18n";
import { getBrand } from "@/lib/brand";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: makeT(locale)("about.title") };
}

export default async function AboutPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const brand = getBrand();

  return (
    <div className="wrap section" style={{ paddingTop: "clamp(2rem,5vw,3.5rem)", maxWidth: "52rem" }}>
      <h1>{t("about.title")}</h1>

      <section className="mt-4" aria-label={t("about.missionTitle")}>
        <span className="chapter-no">01</span>
        <h2>{t("about.missionTitle")}</h2>
        <p className="deck mt-1">{t("about.missionBody")}</p>
        <p className="display mt-3" style={{ fontSize: "clamp(1.5rem,3vw,2.1rem)", fontWeight: 650, fontStyle: "italic" }}>
          {t("about.framing")}
        </p>
        <p className="muted">{t("about.framingBody")}</p>
      </section>

      <section className="section" style={{ paddingBlock: "clamp(2.2rem,5vw,3.4rem)" }} aria-label={t("about.whatTitle")}>
        <span className="chapter-no">02</span>
        <h2>{t("about.whatTitle")}</h2>
        <p className="mt-1" style={{ maxWidth: "40em" }}>{t("about.whatBody")}</p>
      </section>

      <section className="section" style={{ paddingBlock: "clamp(2.2rem,5vw,3.4rem)" }} aria-label={t("about.whatNotTitle")}>
        <span className="chapter-no">03</span>
        <h2>{t("about.whatNotTitle")}</h2>
        <p className="mt-1" style={{ maxWidth: "40em" }}>{t("about.whatNotBody")}</p>
      </section>

      <section className="section" style={{ paddingBlock: "clamp(2.2rem,5vw,3.4rem)" }} aria-label={t("about.brandTitle")}>
        <span className="chapter-no">04</span>
        <h2>{t("about.brandTitle")}</h2>
        <p className="mt-1" style={{ maxWidth: "40em" }}>{t("about.brandBody", { name: brand.name })}</p>
        <div className="notice mt-2" data-tone="attention">
          <span className="mono">{t("common.workingName", { name: brand.name })}</span>
        </div>
      </section>
    </div>
  );
}
