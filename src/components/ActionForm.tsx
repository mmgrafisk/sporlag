"use client";

/**
 * Small JSON-posting form used by internal admin screens
 * (Source Registry, ingestion, brand config). Labels are passed in.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ActionField = {
  name: string;
  label: string;
  type?: "text" | "email" | "textarea" | "select" | "datetime-local";
  options?: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
  hint?: string;
};

export default function ActionForm(props: {
  endpoint: string;
  fields: ActionField[];
  submitLabel: string;
  successLabel: string;
  errorLabel: string;
  title?: string;
  intro?: string;
  wide?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {};
    for (const f of props.fields) payload[f.name] = String(form.get(f.name) ?? "");
    try {
      const res = await fetch(props.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.error) {
        setMsg({ tone: "ok", text: props.successLabel + (data.duplicate ? " (DUPLICATE)" : "") });
        e.currentTarget.reset();
        router.refresh();
      } else {
        setMsg({ tone: "err", text: `${props.errorLabel} (${data.reason ?? data.error ?? res.status})` });
      }
    } catch {
      setMsg({ tone: "err", text: props.errorLabel });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="paper" style={{ padding: "1.4rem 1.5rem", maxWidth: props.wide ? "52rem" : "34rem" }}
      aria-label={props.title}>
      {props.title && <h3 className="mb-1" style={{ fontSize: "1.2rem" }}>{props.title}</h3>}
      {props.intro && <p className="small muted mb-2">{props.intro}</p>}
      {props.fields.map((f) => (
        <div className="field" key={f.name}>
          <label htmlFor={`af-${f.name}`}>{f.label}</label>
          {f.type === "textarea" ? (
            <textarea id={`af-${f.name}`} name={f.name} className="textarea" required={f.required}
              defaultValue={f.defaultValue} rows={8} />
          ) : f.type === "select" ? (
            <select id={`af-${f.name}`} name={f.name} className="select" required={f.required} defaultValue={f.defaultValue}>
              {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input id={`af-${f.name}`} name={f.name} className="input" type={f.type ?? "text"}
              required={f.required} defaultValue={f.defaultValue} />
          )}
          {f.hint && <span className="hint">{f.hint}</span>}
        </div>
      ))}
      <button type="submit" className="btn btn-ink" disabled={busy}>{props.submitLabel}</button>
      {msg && (
        <p className="small mt-1" role="status" style={{ color: msg.tone === "ok" ? "var(--recognition)" : "var(--error)" }}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
