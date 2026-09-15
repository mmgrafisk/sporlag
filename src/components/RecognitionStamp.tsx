"use client";

/**
 * Recognition (§11 MASTER / §6 DESIGN): informative stamp — never official.
 * Criteria open in a native <dialog> (accessible behavior, ESC/focus handled).
 * The surrounding copy always states: documentation, NOT certification (§25).
 */
import { useRef } from "react";
import { SealCheck, X } from "@phosphor-icons/react";

export type RecognitionDimension = { key: string; assessment: string; rationale: string };

export default function RecognitionStamp(props: {
  status: string; // clearly_documented | insufficient_documentation
  label: string; // from brand config — never hardcoded
  insufficientLabel: string;
  insufficientBody: string;
  explainedShort: string;
  openCriteria: string;
  closeLabel: string;
  criteriaTitle: string;
  criteriaIntro: string;
  notCertification: string;
  awardedAtLabel: string;
  awardedAt: string;
  versionLabel: string;
  versionNo: number;
  methodLabel: string;
  methodVersion: string;
  sampleLabel: string;
  sampleSize: number;
  verifiedLabel: string;
  isVerified: boolean;
  dimensions: RecognitionDimension[];
  dimensionLabels: Record<string, string>;
  assessmentLabels: Record<string, string>;
  dimensionIntro: string;
  dialogAria: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const clearlyDocumented = props.status === "clearly_documented";
  const display = clearlyDocumented ? props.label : props.insufficientLabel;

  return (
    <>
      <span className="stamp" data-status={props.status}>
        {clearlyDocumented && <SealCheck size={17} weight="duotone" aria-hidden="true" />}
        {display}
      </span>{" "}
      <button
        type="button"
        className="chip"
        style={{ minHeight: 32 }}
        onClick={() => dialogRef.current?.showModal()}
      >
        {props.openCriteria}
      </button>
      <p className="stamp-note small mt-1">{props.explainedShort}</p>

      <dialog ref={dialogRef} className="criterion-dialog" aria-label={props.dialogAria}>
        <div className="dialog-head">
          <strong className="mono">{props.criteriaTitle}</strong>
          <button type="button" className="dialog-close" onClick={() => dialogRef.current?.close()} aria-label={props.closeLabel}>
            <X size={16} weight="bold" />
          </button>
        </div>
        <div className="dialog-body">
          <p className="small muted">{props.criteriaIntro}</p>

          <dl className="mt-2" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.4rem 1.2rem", fontSize: "0.92rem" }}>
            <dt className="muted mono">{props.versionLabel}</dt>
            <dd style={{ margin: 0 }}>v{String(props.versionNo).padStart(2, "0")}</dd>
            <dt className="muted mono">{props.awardedAtLabel}</dt>
            <dd style={{ margin: 0 }}>{props.awardedAt}</dd>
            <dt className="muted mono">{props.methodLabel}</dt>
            <dd style={{ margin: 0 }}>{props.methodVersion}</dd>
            <dt className="muted mono">{props.sampleLabel}</dt>
            <dd style={{ margin: 0 }}>{props.sampleSize}</dd>
            <dt className="muted mono">{props.verifiedLabel}</dt>
            <dd style={{ margin: 0 }}>{props.isVerified ? "✓" : "—"}</dd>
          </dl>

          <p className="small mt-3 mb-1"><strong>{props.dimensionIntro}</strong></p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {props.dimensions.map((d) => (
              <li key={d.key} className="obs-line" style={{ gap: "0.7rem" }}>
                <span className="obs-text" style={{ flex: 1 }}>
                  {props.dimensionLabels[d.key] ?? d.key}
                </span>
                <span className="mono muted">{props.assessmentLabels[d.assessment] ?? d.assessment}</span>
              </li>
            ))}
          </ul>

          {!clearlyDocumented && (
            <p className="notice mt-2" data-tone="attention">{props.insufficientBody}</p>
          )}
          <p className="notice mt-2 small" data-tone="recognition">{props.notCertification}</p>
        </div>
      </dialog>
    </>
  );
}
