import type { Locale } from "@/lib/i18n";
import { fmtFieldValue } from "@/lib/format";

/**
 * Changed-field diff (§12 BUILD SPEC) — a first-class visual object:
 * NORMAL PRICE  v03 279 kr./md. → v04 299 kr./md.  (+20 kr.)
 * Meaning is never carried by color alone: old value is struck through,
 * delta shows an explicit sign.
 */
export default function DiffBlock(props: {
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
  locale: Locale;
  changeLabel: string;
  fromVersion?: number;
  toVersion?: number;
  changedAt?: string;
  evidenceRef?: string | null;
}) {
  const oldStr = fmtFieldValue(props.oldValue, props.locale);
  const newStr = fmtFieldValue(props.newValue, props.locale);

  let delta: string | null = null;
  let dir: "up" | "down" | null = null;
  const o = props.oldValue as { amount?: number } | null;
  const n = props.newValue as { amount?: number } | null;
  if (o && n && typeof o.amount === "number" && typeof n.amount === "number") {
    const d = n.amount - o.amount;
    if (d !== 0) {
      dir = d > 0 ? "up" : "down";
      delta = `${d > 0 ? "+" : "−"}${Math.abs(d)} ${props.locale === "da-DK" ? "kr." : "DKK"}`;
    }
  }

  return (
    <div className="diff">
      <div className="diff-head">
        <span className="diff-tag">{props.changeLabel}</span>
        <span className="mono muted">{props.fieldLabel}</span>
        {props.fromVersion !== undefined && props.toVersion !== undefined && (
          <span className="mono muted">
            v{String(props.fromVersion).padStart(2, "0")} → v{String(props.toVersion).padStart(2, "0")}
          </span>
        )}
        {props.changedAt && <span className="mono muted">{props.changedAt}</span>}
        {props.evidenceRef && <span className="doc-id">{props.evidenceRef}</span>}
      </div>
      <div className="diff-values">
        <span className="diff-old">{oldStr}</span>
        <span className="diff-arrow" aria-hidden="true">→</span>
        <span className="diff-new">{newStr}</span>
        {delta && <span className="diff-delta" data-dir={dir ?? undefined}>{delta}</span>}
      </div>
    </div>
  );
}
