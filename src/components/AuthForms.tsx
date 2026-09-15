"use client";

/** Sign up / login (§2 consumer account) — calm, factual, one form at a time. */
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AuthForms(props: {
  labels: Record<string, string>;
  next?: string;
}) {
  const router = useRouter();
  const L = props.labels;
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    if (mode === "signup") payload.name = String(form.get("name") ?? "");
    const res = await fetch(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      router.push(props.next ?? "/mit-overblik");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(mode === "signup" ? (data.error ?? L.signupError) : L.error);
    }
  };

  return (
    <div className="paper" style={{ padding: "clamp(1.5rem,4vw,2.5rem)", maxWidth: "28rem" }}>
      <div className="flex gap-2 mb-3" role="tablist" aria-label={mode === "signup" ? L.signupTitle : L.loginTitle}>
        <button
          type="button" role="tab" aria-selected={mode === "login"}
          className={`chip ${mode === "login" ? "" : ""}`} data-on={mode === "login" ? "true" : undefined}
          style={{ minHeight: 44, fontSize: "0.85rem" }}
          onClick={() => setMode("login")}
        >
          {L.loginTitle}
        </button>
        <button
          type="button" role="tab" aria-selected={mode === "signup"}
          className="chip" data-on={mode === "signup" ? "true" : undefined}
          style={{ minHeight: 44, fontSize: "0.85rem" }}
          onClick={() => setMode("signup")}
        >
          {L.signupTitle}
        </button>
      </div>

      {error && <div className="alert-err" role="alert">{error}</div>}

      <form onSubmit={submit}>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="name">{L.name}</label>
            <input className="input" id="name" name="name" type="text" required minLength={2} autoComplete="name" />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">{L.email}</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">{L.password}</label>
          <input className="input" id="password" name="password" type="password" required minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          {mode === "signup" && <span className="hint">{L.passwordHint}</span>}
        </div>
        <button type="submit" className="btn" disabled={busy} style={{ width: "100%" }}>
          {mode === "signup" ? L.signupBtn : L.loginBtn}
        </button>
      </form>

      <p className="small muted mt-2">{L.demoNote}</p>
    </div>
  );
}
