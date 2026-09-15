"use client";

/**
 * REVIEW STUDIO (§10 BUILD SPEC / §21 DESIGN) — split screen:
 *   left:  ORIGINAL SOURCE (normalized text only — scripts never execute)
 *   right: AI EXTRACTION (value, confidence, evidence, verification status)
 * Click a field → the exact evidence span is highlighted in the source.
 * Per-field: Confirm / Edit / Unknown. Offer-level: duplicate / update /
 * merge (accept match) / split (new offer) / not an offer.
 * Human corrections retain the AI prediction (Verified Offer Dataset).
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, PencilSimple, Question, MagnifyingGlass, GitMerge, Scissors, Prohibit } from "@phosphor-icons/react";

export type StudioField = {
  id: string;
  field: string;
  label: string;
  valueFmt: string;
  valueJson: unknown;
  evidence_span: string;
  locator: { start: number; end: number };
  confidence: number;
  extractor_version: string;
  verification_status: string;
};

export type StudioMatch = {
  id: string;
  candidate_offer_id: string;
  confidence: number;
  reason_codes: string[];
  changed_fields: string[];
  reviewer_decision: string | null;
  claim_original: string | null;
  version: number | null;
};

export type StudioExtraction = {
  id: string;
  offer_type: string | null;
  headline: string | null;
  claim_original: string;
  status: string;
  is_offer: boolean;
  fields: StudioField[];
  match_candidates: StudioMatch[];
};

export default function StudioMessage(props: {
  message: {
    id: string; subject: string; text: string; state: string;
    source_name: string; company_name: string; received_at: string; fingerprint: string;
    links: { href: string; text: string }[];
  };
  extractions: StudioExtraction[];
  labels: Record<string, string>;
  reasonLabels: Record<string, string>;
  stateLabel: string;
}) {
  const L = props.labels;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [active, setActive] = useState<{ extractionId: string; fieldId: string; start: number; end: number } | null>(null);
  const [editField, setEditField] = useState<StudioField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [acceptedMatch, setAcceptedMatch] = useState<Record<string, string | null>>({}); // extractionId → offerId|null
  const markRef = useRef<HTMLElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);

  const refresh = () => startTransition(() => router.refresh());

  const post = async (url: string, payload?: unknown, busyKey?: string): Promise<Record<string, unknown> | null> => {
    if (busyKey) setBusy(busyKey);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload !== undefined ? JSON.stringify(payload) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setNote(`${L.opFailed} (${data.error ?? res.status})`);
        return null;
      }
      return data as Record<string, unknown>;
    } finally {
      if (busyKey) setBusy(null);
    }
  };

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);

  // Source pane: normalized text with the active evidence span highlighted
  const sourceParts = useMemo(() => {
    const text = props.message.text;
    if (!active) return [{ text, hl: false }];
    const { start, end } = active;
    return [
      { text: text.slice(0, start), hl: false },
      { text: text.slice(start, end), hl: true },
      { text: text.slice(end), hl: false },
    ];
  }, [props.message.text, active]);

  const fieldAction = async (extractionId: string, f: StudioField, action: "confirm" | "unknown") => {
    setNote(null);
    const data = await post(`/api/internal/extractions/${extractionId}/correct`, { field_id: f.id, action }, `${extractionId}:${f.id}`);
    if (data) { setNote(action === "confirm" ? L.saved : L.saved); refresh(); }
  };

  const openEdit = (f: StudioField) => {
    setEditField(f);
    setEditValue(JSON.stringify(f.valueJson, null, 2));
    editDialogRef.current?.showModal();
  };

  const saveEdit = async (extractionId: string) => {
    if (!editField) return;
    let value: unknown;
    try {
      value = JSON.parse(editValue);
    } catch {
      value = { text: editValue };
    }
    editDialogRef.current?.close();
    const data = await post(`/api/internal/extractions/${extractionId}/correct`,
      { field_id: editField.id, action: "edit", value }, `${extractionId}:${editField.id}:edit`);
    if (data) { setNote(L.correctionSaved); setEditField(null); refresh(); }
  };

  const runMatch = async (extractionId: string) => {
    setNote(null);
    const data = await post(`/api/internal/offers/match`, { extraction_id: extractionId }, `${extractionId}:match`);
    if (data) { setNote(L.matchDone); refresh(); }
  };

  const decideMatch = async (extractionId: string, mc: StudioMatch, decision: "accept" | "reject") => {
    const data = await post(`/api/internal/match-candidates/${mc.id}/decision`, { decision }, `${mc.id}:decide`);
    if (data) {
      setAcceptedMatch((prev) => ({ ...prev, [extractionId]: decision === "accept" ? mc.candidate_offer_id : null }));
      refresh();
    }
  };

  const verify = async (extractionId: string) => {
    setNote(null);
    const data = await post(`/api/internal/extractions/${extractionId}/verify`, undefined, `${extractionId}:verify`);
    if (data) { setNote(L.verifiedNow); refresh(); }
    else setNote(L.allFieldsRequired);
  };

  const commit = async (extractionId: string) => {
    setNote(null);
    const matched = acceptedMatch[extractionId] ?? null;
    const data = await post(`/api/internal/extractions/${extractionId}/commit`,
      { matched_offer_id: matched }, `${extractionId}:commit`);
    if (data) {
      const changed = (data.changed_fields as string[] | undefined) ?? [];
      setNote(`${L.commitDone}${changed.length ? " · " + L.changedFieldsNote + ": " + changed.join(", ") : ""}`);
      refresh();
    }
  };

  const offerAction = async (extractionId: string, action: string) => {
    setNote(null);
    const data = await post(`/api/internal/extractions/${extractionId}/correct`, { offer_action: action }, `${extractionId}:${action}`);
    if (data) { setNote(L.saved); refresh(); }
  };

  const pendingCount = (ex: StudioExtraction) =>
    ex.fields.filter((f) => f.verification_status === "pending").length;

  return (
    <div>
      {note && <div className="alert-ok" role="status">{note}</div>}

      <div className="studio-layout">
        {/* ---------------- LEFT: ORIGINAL SOURCE ---------------- */}
        <div className="studio-pane">
          <div className="studio-pane-head">
            <strong className="mono">{L.sourcePane}</strong>
            <span className="state-pill" data-state={props.message.state}>{props.stateLabel}</span>
          </div>
          <p className="small muted">
            {props.message.company_name} · {props.message.source_name} · {props.message.received_at}
          </p>
          <p className="small"><strong>{L.subjectLabel}:</strong> {props.message.subject}</p>
          <div className="notice small mb-2" data-tone="attention">{L.privateNotice}</div>
          <div className="studio-source-text" aria-label={L.sourcePane}>
            {sourceParts.map((p, i) =>
              p.hl ? (
                <mark key={i} className="evidence-hl" ref={markRef}>{p.text}</mark>
              ) : (
                <span key={i}>{p.text}</span>
              )
            )}
          </div>
          {props.message.links.length > 0 && (
            <details className="mt-2">
              <summary className="mono muted" style={{ cursor: "pointer" }}>{L.linksLabel} ({props.message.links.length})</summary>
              <ul className="small mt-1" style={{ paddingLeft: "1.2rem" }}>
                {props.message.links.map((l, i) => (
                  <li key={i} style={{ wordBreak: "break-all" }}>
                    <span className="muted">{l.text}</span> — <code className="mono">{l.href}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="mono muted small mt-2">FINGERPRINT {props.message.fingerprint.slice(0, 16)}…</p>
        </div>

        {/* ---------------- RIGHT: AI EXTRACTION ---------------- */}
        <div className="studio-pane">
          <div className="studio-pane-head">
            <strong className="mono">{L.extractionPane}</strong>
            <span className="mono muted">{L.extractorVersion}</span>
          </div>
          <p className="small muted mb-2">{L.clickHint}</p>

          {props.extractions.length === 0 && (
            <div className="notice">
              {L.noExtractions}{" "}
              <button type="button" className="btn btn-sm mt-1" disabled={busy === "extract"}
                onClick={async () => {
                  const data = await post(`/api/internal/messages/${props.message.id}/extract`, undefined, "extract");
                  if (data) { setNote(L.extracted); refresh(); }
                }}>
                {L.extractBtn}
              </button>
            </div>
          )}

          {props.extractions.map((ex, exIdx) => {
            const decided = ex.match_candidates.find((m) => m.reviewer_decision === "accept");
            const isVerified = ex.status === "confirmed";
            return (
              <section key={ex.id} className="paper mb-3" style={{ padding: "1.1rem 1.2rem" }}
                aria-label={`${L.candidateLabel} ${exIdx + 1}`}>
                <header className="flex justify-between items-center flex-wrap gap-1 mb-2">
                  <div>
                    <span className="doc-id">{L.candidateLabel} {String(exIdx + 1).padStart(2, "0")}</span>{" "}
                    <span className="doc-id">{ex.offer_type ?? "—"}</span>{" "}
                    {isVerified && <span className="state-pill" data-state="VERIFIED">{L.verifiedMark}</span>}
                    {!isOfferActive(ex) && <span className="state-pill">{L.notAnOfferMark}</span>}
                  </div>
                  <span className="mono muted">{ex.headline ?? ""}</span>
                </header>

                {isOfferActive(ex) && (
                  <>
                    {/* Fields */}
                    <div role="list">
                      {ex.fields.map((f) => {
                        const isActive = active?.fieldId === f.id;
                        return (
                          <div key={f.id} role="listitem">
                            <button
                              type="button"
                              className="studio-field"
                              data-active={isActive ? "true" : "false"}
                              data-status={f.verification_status}
                              onClick={() => setActive({ extractionId: ex.id, fieldId: f.id, start: f.locator.start, end: f.locator.end })}
                              aria-label={`${f.label}: ${f.valueFmt}`}
                            >
                              <span className="studio-field-name">
                                {f.label} · {L.confidenceLabel} {f.confidence.toFixed(2)}
                              </span>
                              <span className="studio-field-actions" onClick={(e) => e.stopPropagation()}>
                                <button type="button" className="chip" data-on={f.verification_status === "confirmed" ? "true" : undefined}
                                  title={L.confirm} aria-label={`${L.confirm} ${f.label}`}
                                  disabled={busy === `${ex.id}:${f.id}`}
                                  onClick={() => fieldAction(ex.id, f, "confirm")}>
                                  <Check size={13} weight="bold" /> {L.confirm}
                                </button>
                                <button type="button" className="chip" data-on={f.verification_status === "edited" ? "true" : undefined}
                                  title={L.edit} aria-label={`${L.edit} ${f.label}`}
                                  onClick={() => openEdit(f)}>
                                  <PencilSimple size={13} weight="bold" /> {L.edit}
                                </button>
                                <button type="button" className="chip" data-on={f.verification_status === "unknown" ? "true" : undefined}
                                  title={L.unknown} aria-label={`${L.unknown} ${f.label}`}
                                  disabled={busy === `${ex.id}:${f.id}`}
                                  onClick={() => fieldAction(ex.id, f, "unknown")}>
                                  <Question size={13} weight="bold" /> {L.unknown}
                                </button>
                              </span>
                              <span className="studio-field-value">{f.valueFmt}</span>
                              <span className="studio-field-evidence">“{f.evidence_span}”</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Offer-level actions */}
                    <div className="flex gap-1 flex-wrap mt-2" role="group" aria-label={L.offerActions}>
                      <span className="mono muted" style={{ alignSelf: "center" }}>{L.offerActions}:</span>
                      <button type="button" className="chip" disabled={busy === `${ex.id}:duplicate`}
                        onClick={() => offerAction(ex.id, "not_an_offer")} title={L.duplicateHint}>
                        <Prohibit size={13} /> {L.actNotAnOffer}
                      </button>
                    </div>

                    {/* Matching */}
                    <div className="mt-3" style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
                      <strong className="mono">{L.matchTitle}</strong>
                      <div className="flex gap-1 flex-wrap mt-1">
                        <button type="button" className="btn btn-quiet btn-sm" disabled={busy === `${ex.id}:match`}
                          onClick={() => runMatch(ex.id)}>
                          <MagnifyingGlass size={14} weight="bold" /> {L.matchRun}
                        </button>
                      </div>

                      {ex.match_candidates.length === 0 && (
                        <p className="small muted mt-1">{L.matchNone}</p>
                      )}
                      {ex.match_candidates.map((mc) => (
                        <div key={mc.id} className="paper-soft mt-1" style={{ padding: "0.8rem 1rem" }}>
                          <div className="flex justify-between flex-wrap gap-1">
                            <span className="small">
                              <a href={`/tilbud/${mc.candidate_offer_id}`}>{mc.claim_original ?? mc.candidate_offer_id}</a>
                              {mc.version !== null && <span className="mono muted"> · v{String(mc.version).padStart(2, "0")}</span>}
                            </span>
                            <span className="mono">{L.matchConfidence}: {mc.confidence.toFixed(2)}</span>
                          </div>
                          <p className="small muted mt-0" style={{ marginBottom: "0.35rem" }}>
                            {L.reasonCodes}: {mc.reason_codes.map((r) => props.reasonLabels[r] ?? r).join(" · ")}
                          </p>
                          {mc.changed_fields.length > 0 && (
                            <p className="small" style={{ marginBottom: "0.5rem" }}>
                              <strong>{L.changedFields}:</strong> {mc.changed_fields.join(", ")}
                            </p>
                          )}
                          {mc.reviewer_decision ? (
                            <span className="state-pill" data-state={mc.reviewer_decision === "accept" ? "VERIFIED" : undefined}>
                              {mc.reviewer_decision === "accept" ? L.decidedAccept : L.decidedReject}
                            </span>
                          ) : (
                            <span className="flex gap-1 flex-wrap">
                              <button type="button" className="btn btn-sm" disabled={busy === `${mc.id}:decide`}
                                onClick={() => decideMatch(ex.id, mc, "accept")}>
                                <GitMerge size={14} weight="bold" /> {L.matchAccept} ({L.mergeLabel})
                              </button>
                              <button type="button" className="btn btn-quiet btn-sm" disabled={busy === `${mc.id}:decide`}
                                onClick={() => decideMatch(ex.id, mc, "reject")}>
                                <Scissors size={14} weight="bold" /> {L.matchReject} ({L.splitLabel})
                              </button>
                            </span>
                          )}
                        </div>
                      ))}
                      {decided && (
                        <p className="small mt-1" style={{ color: "var(--recognition)" }}>
                          {L.willMerge}: <a href={`/tilbud/${decided.candidate_offer_id}`}>{decided.candidate_offer_id}</a>
                        </p>
                      )}
                      <p className="small muted mt-1">{L.matchOverrideNote}</p>
                    </div>

                    {/* Verify + commit */}
                    <div className="mt-3" style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
                      <strong className="mono">{L.commitTitle}</strong>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {!isVerified ? (
                          <button type="button" className="btn btn-sm" disabled={busy === `${ex.id}:verify` || pendingCount(ex) > 0}
                            onClick={() => verify(ex.id)}>
                            {L.commitVerify}
                          </button>
                        ) : (
                          <span className="state-pill" data-state="VERIFIED">{L.commitVerified} ✓</span>
                        )}
                        {isVerified && (
                          <button type="button" className="btn btn-ink btn-sm" disabled={busy === `${ex.id}:commit`}
                            onClick={() => commit(ex.id)}>
                            {(acceptedMatch[ex.id] ?? decided?.candidate_offer_id) ? L.commitVersion : L.commitNewOffer}
                          </button>
                        )}
                      </div>
                      {pendingCount(ex) > 0 && !isVerified && (
                        <p className="small muted mt-1">
                          {L.allFieldsRequired} ({pendingCount(ex)} {L.pendingMark.toLowerCase()})
                        </p>
                      )}
                      <p className="small muted mt-1">{L.publishNote}</p>
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Edit dialog (semantic dialog behavior §23) */}
      <dialog ref={editDialogRef} className="criterion-dialog" aria-label={L.editDialogTitle}>
        {editField && (
          <form method="dialog" className="dialog-body" onSubmit={(e) => e.preventDefault()}>
            <div className="dialog-head" style={{ margin: "-1.3rem -1.4rem 1.2rem", padding: "1.1rem 1.4rem" }}>
              <strong className="mono">{L.editDialogTitle}</strong>
              <button type="button" className="dialog-close" onClick={() => editDialogRef.current?.close()}>✕</button>
            </div>
            <p className="small muted">{editField.label} · {L.evidenceLabel}: “{editField.evidence_span}”</p>
            <div className="field">
              <label htmlFor="edit-value">{L.editValue}</label>
              <textarea id="edit-value" className="textarea" value={editValue}
                onChange={(e) => setEditValue(e.target.value)} rows={6} />
              <span className="hint">{L.editHint}</span>
            </div>
            <div className="flex gap-1">
              <button type="button" className="btn"
                onClick={() => saveEdit(props.extractions.find((x) => x.fields.some((f) => f.id === editField.id))?.id ?? "")}>
                {L.save}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => editDialogRef.current?.close()}>
                {L.cancel}
              </button>
            </div>
            <p className="small muted mt-2">{L.correctionNote}</p>
          </form>
        )}
      </dialog>
    </div>
  );
}

function isOfferActive(ex: StudioExtraction): boolean {
  return ex.is_offer && ex.status !== "not_an_offer";
}
