"use client";

/**
 * Sign up / login (§2 consumer account) — calm, factual, one form at a time.
 * Demo accounts are one-click so validation testers can reach admin/studio.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

const DEMO = [
  { email: "forbruger@demo.dk", role: "consumer" },
  { email: "ambassadoer@demo.dk", role: "ambassador" },
  { email: "redaktor@demo.dk", role: "editor" },
  { email: "admin@demo.dk", role: "admin" },
] as const;

export default function AuthForms(props: {
  labels: Record<string, string>;
  next?: string;
  initialMode?: "login" | "signup";
}) {
  const router = useRouter();
  const L = props.labels;
  const [mode, setMode] = useState<"login" | "signup">(props.initialMode ?? "login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const fillDemo = (addr: string) => {
    setMode("login");
    setEmail(addr);
    setPassword("demo1234");
    setError(null);
  };

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
    try {
      const res = await fetch(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(props.next ?? "/mit-overblik");
        router.refresh();
        return;
      }
      const key = typeof data.error === "string" ? data.error : "";
      if (key === "auth.errCsrf") setError(L.errorCsrf ?? L.error);
      else if (mode === "signup") setError(L.signupError);
      else setError(L.error);
    } catch {
      setError(L.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="paper auth-card">
      <div className="flex gap-2 mb-3" role="tablist" aria-label={mode === "signup" ? L.signupTitle : L.loginTitle}>
        <button
          type="button" role="tab" aria-selected={mode === "login"}
          className="chip" data-on={mode === "login" ? "true" : undefined}
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
          <input className="input" id="email" name="email" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">{L.password}</label>
          <input className="input" id="password" name="password" type="password" required minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === "signup" && <span className="hint">{L.passwordHint}</span>}
        </div>
        <button type="submit" className="btn" disabled={busy} style={{ width: "100%" }}>
          {mode === "signup" ? L.signupBtn : L.loginBtn}
        </button>
      </form>

      {mode === "login" && (
        <div className="demo-accounts">
          <p className="mono muted mb-1">{L.demoPick}</p>
          <div className="flex flex-wrap gap-1">
            {DEMO.map((d) => (
              <button key={d.email} type="button" className="chip" style={{ minHeight: 36 }}
                onClick={() => fillDemo(d.email)}>
                {d.email}
              </button>
            ))}
          </div>
          <p className="small muted mt-1">{L.demoNote}</p>
        </div>
      )}
    </div>
  );
}
