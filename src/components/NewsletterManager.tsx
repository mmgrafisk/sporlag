"use client";

/**
 * Mine nyhedsbreve (§17 DESIGN): calm and personal. Search → select /
 * deselect → see pending review tasks → suggest a missing company
 * (suggestions are moderated, never auto-published, §15).
 */
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { MagnifyingGlass, EnvelopeSimple, Check, PaperPlaneTilt } from "@phosphor-icons/react";

export type SelectionRow = {
  source_id: string; source_name: string; company_name: string; company_slug: string;
  open_tasks: number; last_observed: string | null; last_change: string | null;
  selectedLabel?: string;
};
export type AvailableRow = {
  source_id: string; source_name: string; company_name: string; company_slug: string;
  published_offers: number;
};

export default function NewsletterManager(props: {
  selections: (SelectionRow & { last_observed_fmt: string; last_change_fmt: string })[];
  available: AvailableRow[];
  labels: Record<string, string>;
}) {
  const L = props.labels;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sugName, setSugName] = useState("");
  const [sugNote, setSugNote] = useState("");
  const [sugMsg, setSugMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const selectedIds = useMemo(() => new Set(props.selections.map((s) => s.source_id)), [props.selections]);
  const filteredAvailable = props.available.filter(
    (a) =>
      !selectedIds.has(a.source_id) &&
      (a.company_name.toLowerCase().includes(search.toLowerCase()) ||
        a.source_name.toLowerCase().includes(search.toLowerCase()))
  );

  const toggle = async (sourceId: string, add: boolean) => {
    const res = await fetch(`/api/users/me/newsletters/${sourceId}`, { method: add ? "POST" : "DELETE" });
    if (res.ok) startTransition(() => router.refresh());
  };

  const suggest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSugMsg(null);
    const res = await fetch("/api/companies/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: sugName, note: sugNote }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      setSugMsg({ tone: "ok", text: data.deduplicated ? L.suggestDupe : L.suggestSuccess });
      setSugName(""); setSugNote("");
    } else if (res.ok && data.duplicate_of) {
      setSugMsg({ tone: "err", text: L.suggestDupe });
    } else {
      setSugMsg({ tone: "err", text: L.errorGeneric });
    }
  };

  return (
    <div className="stack" style={{ gap: "2.5rem" }}>
      {/* Selected */}
      <section aria-labelledby="selected-h">
        <h2 id="selected-h" style={{ fontSize: "1.4rem" }} className="mb-2">{L.selectedTitle}</h2>
        {props.selections.length === 0 ? (
          <p className="muted">{L.empty}</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{L.colCompany}</th>
                  <th>{L.colPending}</th>
                  <th>{L.colLastChange}</th>
                  <th>{L.colLastObserved}</th>
                  <th aria-label="actions"></th>
                </tr>
              </thead>
              <tbody>
                {props.selections.map((s) => (
                  <tr key={s.source_id}>
                    <td>
                      <a href={`/virksomheder/${s.company_slug}`} style={{ fontWeight: 650, color: "var(--ink)" }}>
                        {s.company_name}
                      </a>
                      <div className="small muted">{s.source_name}</div>
                    </td>
                    <td>
                      {s.open_tasks > 0 ? (
                        <span className="badge-changed" style={{ color: "var(--primary)", borderColor: "var(--primary)" }}>
                          {s.open_tasks}
                        </span>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td className="small">{s.last_change_fmt}</td>
                    <td className="small">{s.last_observed_fmt}</td>
                    <td>
                      <div className="flex gap-1">
                        {s.open_tasks > 0 && (
                          <a className="btn btn-sm" href="/vurderinger">{L.reviewBtn}</a>
                        )}
                        <button type="button" className="btn btn-quiet btn-sm" onClick={() => toggle(s.source_id, false)}>
                          {L.removeBtn}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Find more */}
      <section aria-labelledby="available-h">
        <h2 id="available-h" style={{ fontSize: "1.4rem" }} className="mb-2">{L.availableTitle}</h2>
        <div className="field" style={{ maxWidth: "26rem" }}>
          <label htmlFor="nl-search" className="sr-only">{L.searchPlaceholder}</label>
          <div style={{ position: "relative" }}>
            <MagnifyingGlass size={18} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted-ink)" }} aria-hidden="true" />
            <input
              id="nl-search" className="input" type="search"
              placeholder={L.searchPlaceholder}
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "2.5rem" }}
            />
          </div>
        </div>
        {filteredAvailable.length === 0 ? (
          <p className="muted">{L.noSearchResults}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, maxWidth: "40rem" }}>
            {filteredAvailable.map((a) => (
              <li key={a.source_id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem",
                padding: "0.85rem 0", borderBottom: "1px solid var(--line)", flexWrap: "wrap",
              }}>
                <span>
                  <strong>{a.company_name}</strong>
                  <span className="small muted"> · {a.source_name}</span>
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(a.source_id, true)}>
                  {selectedIds.has(a.source_id) ? <Check size={15} weight="bold" /> : <EnvelopeSimple size={15} />}
                  {L.addBtn.replace("{company}", a.company_name)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Suggest missing company */}
      <section aria-labelledby="suggest-h" className="paper-soft" style={{ padding: "clamp(1.3rem,3vw,2rem)", maxWidth: "40rem" }}>
        <h2 id="suggest-h" style={{ fontSize: "1.25rem" }} className="mb-1">
          <PaperPlaneTilt size={18} weight="duotone" style={{ marginRight: 8, verticalAlign: -3 }} aria-hidden="true" />
          {L.suggestTitle}
        </h2>
        <p className="small muted mb-2">{L.suggestIntro}</p>
        <form onSubmit={suggest}>
          <div className="field">
            <label htmlFor="sug-name">{L.suggestName}</label>
            <input id="sug-name" className="input" required minLength={2} value={sugName}
              onChange={(e) => setSugName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sug-note">{L.suggestNote}</label>
            <input id="sug-note" className="input" value={sugNote} onChange={(e) => setSugNote(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-ink">{L.suggestBtn}</button>
          {sugMsg && (
            <p className="small mt-1" role="status" style={{ color: sugMsg.tone === "ok" ? "var(--recognition)" : "var(--error)" }}>
              {sugMsg.text}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
