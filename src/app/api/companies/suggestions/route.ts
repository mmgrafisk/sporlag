import { requireUser, json, err, body, contributionAllowed } from "@/lib/api";
import { q1, run, nextId, nowIso } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/companies/suggestions (§15)
 * Missing-company suggestions: NOT published automatically, moderated,
 * deduplicated against existing company records.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (!contributionAllowed(request, auth.user)) return err("auth.errRateLimit", 429);

  const b = await body<{ company_name?: string; note?: string }>(request);
  const name = b?.company_name?.trim() ?? "";
  if (name.length < 2 || name.length > 120) return err("auth.errGeneric", 400);

  // dedupe against existing companies (case-insensitive)
  const dupe = q1<{ id: string; name: string }>(
    `SELECT id, name FROM companies WHERE LOWER(name) = LOWER(?)`, name
  );
  if (dupe) return json({ ok: false, duplicate_of: dupe.name }, 200);

  // dedupe against pending suggestions
  const pending = q1<{ id: string }>(
    `SELECT id FROM company_suggestions WHERE LOWER(company_name) = LOWER(?) AND status = 'pending'`, name
  );
  if (pending) return json({ ok: true, deduplicated: true }, 200);

  const id = nextId("csug", "company_suggestions");
  run(
    `INSERT INTO company_suggestions (id, user_id, company_name, note, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    id, auth.user.id, name, b?.note?.trim() || null, nowIso()
  );
  logAudit(auth.user.id, "suggestion.created", "company_suggestion", id, { name });
  return json({ ok: true, id });
}
