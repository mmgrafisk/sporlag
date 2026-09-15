"use client";

/** CTA: "Jeg modtager deres nyhedsbrev" (§5.5) — select/deselect a source. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EnvelopeSimple, Check } from "@phosphor-icons/react";

export default function NewsletterSelectButton(props: {
  sourceId: string;
  selected: boolean;
  labels: { receive: string; receiving: string; stop: string; loginFirst: string };
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(props.selected);
  const [pending, startTransition] = useTransition();

  const toggle = async () => {
    if (!props.isLoggedIn) {
      router.push("/konto?next=" + encodeURIComponent(window.location.pathname));
      return;
    }
    const res = await fetch(`/api/users/me/newsletters/${props.sourceId}`, {
      method: selected ? "DELETE" : "POST",
    });
    if (res.ok) {
      setSelected(!selected);
      startTransition(() => router.refresh());
    }
  };

  return (
    <button
      type="button"
      className={selected ? "btn btn-quiet" : "btn"}
      onClick={toggle}
      disabled={pending}
      aria-pressed={selected}
    >
      {selected ? <Check size={17} weight="bold" /> : <EnvelopeSimple size={17} weight="duotone" />}
      {selected ? props.labels.receiving : props.labels.receive}
    </button>
  );
}
