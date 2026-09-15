"use client";

/** CTA: "Jeg modtager deres nyhedsbrev" (§5.5) — select/deselect a source. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EnvelopeSimple, Check } from "@phosphor-icons/react";

export default function NewsletterSelectButton(props: {
  sourceId: string;
  selected: boolean;
  labels: { receive: string; receiving: string; stop: string; loginFirst: string; errorGeneric: string };
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(props.selected);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const toggle = async () => {
    if (!props.isLoggedIn) {
      router.push("/konto?next=" + encodeURIComponent(window.location.pathname));
      return;
    }

    setError("");
    try {
      const res = await fetch(`/api/users/me/newsletters/${props.sourceId}`, {
        method: selected ? "DELETE" : "POST",
      });
      if (!res.ok) {
        setError(props.labels.errorGeneric);
        return;
      }
      setSelected(!selected);
      startTransition(() => router.refresh());
    } catch {
      setError(props.labels.errorGeneric);
    }
  };

  return (
    <span>
      <button
        type="button"
        className={selected ? "btn btn-quiet" : "btn"}
        onClick={toggle}
        disabled={pending}
        aria-pressed={selected}
        aria-describedby={error ? `newsletter-error-${props.sourceId}` : undefined}
      >
        {selected ? <Check size={17} weight="bold" /> : <EnvelopeSimple size={17} weight="duotone" />}
        {selected ? props.labels.receiving : props.labels.receive}
      </button>
      {error && (
        <span id={`newsletter-error-${props.sourceId}`} className="small" role="alert" style={{ display: "block", marginTop: "0.5rem", color: "var(--error)" }}>
          {error}
        </span>
      )}
    </span>
  );
}
