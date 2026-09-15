import type { Metadata } from "next";
import { getLocale, makeT } from "@/lib/i18n";
import { getBrand } from "@/lib/brand";
import { EXTRACTOR_VERSION } from "@/lib/extractor";
import { RECOGNITION_METHOD_VERSION } from "@/lib/recognition";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: makeT(locale)("methodology.title") };
}

/** Methodology / Recognition — transparency as a page, not a footnote. */
export default async function MethodologyPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const brand = getBrand();

  const steps = [
    t("methodology.pipeline1"), t("methodology.pipeline2"),
    t("methodology.pipeline3", { version: EXTRACTOR_VERSION }),
    t("methodology.pipeline4"), t("methodology.pipeline5"), t("methodology.pipeline6"),
  ];

  const sections: { no: string; title: string; body: string; extra?: React.ReactNode }[] = [
    { no: "02", title: t("methodology.matchingTitle"), body: t("methodology.matchingBody") },
    {
      no: "03", title: t("methodology.recognitionTitle"),
      body: t("methodology.recognitionBody", { label: brand.recognitionName }),
      extra: (
        <p className="mt-2">
          <span className="stamp">{brand.recognitionName}</span>{" "}
          <span className="mono muted">{RECOGNITION_METHOD_VERSION}</span>
        </p>
      ),
    },
    { no: "04", title: t("methodology.communityTitle"), body: t("methodology.communityBody") },
    { no: "05", title: t("methodology.versionsTitle"), body: t("methodology.versionsBody") },
    { no: "06", title: t("methodology.privacyTitle"), body: t("methodology.privacyBody") },
    { no: "07", title: t("methodology.noLegalTitle"), body: t("methodology.noLegalBody") },
  ];

  return (
    <div className="wrap section" style={{ paddingTop: "clamp(2rem,5vw,3.5rem)", maxWidth: "52rem" }}>
      <h1>{t("methodology.title")}</h1>
      <p className="deck mt-1">{t("methodology.intro")}</p>

      <section className="mt-4" aria-labelledby="pipeline-h">
        <span className="chapter-no">01</span>
        <h2 id="pipeline-h">{t("methodology.pipelineTitle")}</h2>
        <ol style={{ listStyle: "none", margin: "1.5rem 0 0", padding: 0 }}>
          {steps.map((s, i) => (
            <li key={i} className="pipeline-step">
              <span className="mono" style={{ color: "var(--oxide)" }}>{String(i + 1).padStart(2, "0")}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <p className="mono muted mt-2">
          EXTRACTOR {EXTRACTOR_VERSION} · RECOGNITION {RECOGNITION_METHOD_VERSION}
        </p>
      </section>

      {sections.map((s) => (
        <section key={s.no} className="section" style={{ paddingBlock: "clamp(2.2rem,5vw,3.4rem)" }} aria-label={s.title}>
          <span className="chapter-no">{s.no}</span>
          <h2>{s.title}</h2>
          <p className="mt-1" style={{ maxWidth: "40em" }}>{s.body}</p>
          {s.extra}
        </section>
      ))}
    </div>
  );
}
