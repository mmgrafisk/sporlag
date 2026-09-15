"use client";

/**
 * Generic mutation button — posts JSON to an API route, then refreshes
 * server data. Labels are passed in (all UI strings live in locale files).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function PostButton(props: {
  endpoint: string;
  method?: "POST" | "DELETE";
  label: React.ReactNode;
  body?: unknown;
  variant?: "btn" | "btn-ghost" | "btn-quiet" | "btn-ink" | "btn-danger" | "chip";
  small?: boolean;
  successLabel?: string;
  failureLabel?: string;
  onDone?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const onClick = async () => {
    setMsg(null);
    try {
      const res = await fetch(props.endpoint, {
        method: props.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        body: props.body !== undefined ? JSON.stringify(props.body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.error === undefined) {
        setMsg({ tone: "ok", text: props.successLabel ?? "OK" });
        props.onDone?.();
        startTransition(() => router.refresh());
      } else {
        setMsg({ tone: "err", text: `${props.failureLabel ?? "Fejl"} (${data.error ?? res.status})` });
      }
    } catch {
      setMsg({ tone: "err", text: props.failureLabel ?? "Fejl" });
    }
  };

  const cls =
    props.variant === "chip"
      ? "chip"
      : `btn ${props.variant ?? ""} ${props.small ? "btn-sm" : ""}`.trim();

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <button
        type="button"
        className={cls}
        onClick={onClick}
        disabled={props.disabled || pending}
        title={props.title}
        aria-busy={pending}
      >
        {props.label}
      </button>
      {msg && (
        <span className="small" role="status" style={{ color: msg.tone === "ok" ? "var(--recognition)" : "var(--error)" }}>
          {msg.text}
        </span>
      )}
    </span>
  );
}
