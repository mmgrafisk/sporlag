"use client";

/**
 * THE SPECIMEN (§2 DESIGN): LØFTET / VILKÅRENE / HISTORIKKEN.
 * A layered commercial document. The front sheet (promise) slides aside to
 * reveal the back (actual conditions). Motion communicates evidence (§12);
 * reduced-motion removes the transition (globals.css).
 */
import { useState } from "react";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import Link from "next/link";

export type SpecimenTerm = { label: string; value: string };
export type SpecimenVersion = { n: number; href?: string; current?: boolean; changed?: boolean };

export default function Specimen(props: {
  frontLabel: string;
  backLabel: string;
  historyLabel: string;
  revealLabel: string;
  collapseLabel: string;
  docId?: string;
  company?: string;
  observed?: string;
  claim: string;
  price?: string;
  priceUnit?: string;
  support?: string | null;
  terms: SpecimenTerm[];
  versions?: SpecimenVersion[];
  defaultOpen?: boolean;
  recognitionSlot?: React.ReactNode;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);

  return (
    <div className="specimen">
      <div className="specimen-sheet">
        <div className="specimen-head">
          <span>{props.frontLabel}</span>
          <span>
            {props.docId ? <span className="nowrap">{props.docId} · </span> : null}
            {props.observed ?? ""}
          </span>
        </div>
        <div className="specimen-body">
          {props.company && <div className="mono muted mb-1">{props.company}</div>}
          <p className="specimen-claim">{props.claim}</p>
          {props.price && (
            <p className="specimen-price">
              {props.price} {props.priceUnit && <small>{props.priceUnit}</small>}
            </p>
          )}
          {props.support && <p className="specimen-support">{props.support}</p>}

          <button
            type="button"
            className="btn btn-ghost btn-sm mt-2"
            aria-expanded={open}
            aria-controls="specimen-back"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <ArrowUp size={15} weight="bold" /> : <ArrowDown size={15} weight="bold" />}
            {open ? props.collapseLabel : props.revealLabel}
          </button>

          <div className="specimen-reveal" data-open={open ? "true" : "false"} id="specimen-back">
            <div className="specimen-reveal-inner">
              <div className="specimen-back">
                <span className="mono muted">{props.backLabel}</span>
                <ul className="terms-list mt-1">
                  {props.terms.map((term) => (
                    <li key={term.label}>
                      <span className="term-label">{term.label}</span>
                      <span className="term-value">{term.value}</span>
                    </li>
                  ))}
                  {props.terms.length === 0 && (
                    <li>
                      <span className="term-label">—</span>
                      <span className="term-value">—</span>
                    </li>
                  )}
                </ul>
                {props.recognitionSlot && <div className="mt-2">{props.recognitionSlot}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {props.versions && props.versions.length > 1 && (
        <div className="version-rail" aria-label={props.historyLabel}>
          <span className="mono muted" style={{ marginRight: "0.6rem" }}>{props.historyLabel}</span>
          {props.versions.map((v, i) => (
            <span key={v.n} className="flex items-center">
              {i > 0 && <span className="version-arrow" aria-hidden="true">→</span>}
              {v.href ? (
                <Link href={v.href} className="version-node" data-current={v.current ? "true" : undefined} data-changed={v.changed ? "true" : undefined}>
                  v{String(v.n).padStart(2, "0")}
                </Link>
              ) : (
                <span className="version-node" data-current={v.current ? "true" : undefined} data-changed={v.changed ? "true" : undefined}>
                  v{String(v.n).padStart(2, "0")}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
