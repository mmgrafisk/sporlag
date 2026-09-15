import type { CommunitySummary } from "@/lib/aggregation";
import type { Locale } from "@/lib/i18n";
import { makeT } from "@/lib/i18n";

/**
 * Community aggregate (§17): counts + sample size, never star ratings,
 * never misleading precision on tiny samples.
 */
export default function CommunitySummaryView(props: {
  summary: CommunitySummary;
  locale: Locale;
  noObservations: string;
  receiversLabel: string; // "modtagere vurderede tilbuddet"
}) {
  const t = makeT(props.locale);
  const s = props.summary;
  if (s.sample_size === 0) {
    return <p className="muted">{props.noObservations}</p>;
  }

  const lineFor = (question: string, key: string, tone: "clear" | "partial" | "unclear"): React.ReactNode => {
    const qq = s.questions.find((x) => x.question === question);
    if (!qq) return null;
    const count = qq.counts[key] ?? 0;
    const labelKey =
      question === "worked_as_described" ? "community.workedClear"
      : question === "price_clarity" ? "community.priceClear"
      : question === "period_clarity" ? "community.periodClear"
      : question === "post_intro_clarity" ? "community.postIntroClear"
      : "community.conditionsClear";
    return (
      <div className="obs-line" key={`${question}-${key}`}>
        <span className="obs-count" data-tone={tone}>{count}</span>
        <span className="obs-text">{t(labelKey, { count })}</span>
      </div>
    );
  };

  const unknownTotal = s.questions.reduce((acc, qq) => acc + (qq.counts["unknown"] ?? 0), 0);

  return (
    <div>
      <p className="mono muted mb-2">
        {t("community.receiversAssessed", { count: s.sample_size })}
      </p>
      {lineFor("price_clarity", "clear", "clear")}
      {lineFor("period_clarity", "clear", "clear")}
      {lineFor("post_intro_clarity", "clear", "clear")}
      {lineFor("conditions_visibility", "clear", "clear")}
      {lineFor("worked_as_described", "confirmed", "clear")}
      {lineFor("price_clarity", "partial", "partial")}
      {lineFor("post_intro_clarity", "unclear", "unclear")}
      {unknownTotal > 0 && (
        <div className="obs-line">
          <span className="obs-count">{unknownTotal}</span>
          <span className="obs-text">{t("community.unknownCount", { count: unknownTotal })}</span>
        </div>
      )}
      <p className="small muted mt-2">
        {s.small_sample ? t("community.smallSample") : t("community.sampleLine", { count: s.sample_size })}
      </p>
      {props.receiversLabel && <span className="sr-only">{props.receiversLabel}</span>}
    </div>
  );
}
