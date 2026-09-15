import { requireRole, json, err, body, EDITORIAL, ADMIN } from "@/lib/api";
import { sourceRegistry } from "@/lib/queries";
import { q1, run, nextId, nowIso } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** GET /api/internal/newsletter-sources — Source Registry (editorial roles). */
export async function GET(request: Request) {
  const auth = await requireRole(request, [...EDITORIAL, "b2b_user"]);
  if ("error" in auth) return auth.error;
  return json({ sources: sourceRegistry() });
}

/** POST — register a legitimate public newsletter source with platform alias (§8). */
export async function POST(request: Request) {
  const auth = await requireRole(request, [...EDITORIAL, ...ADMIN]);
  if ("error" in auth) return auth.error;

  const b = await body<{
    company_id?: string; name?: string; alias_email?: string;
    language?: string; source_confidence?: string;
  }>(request);
  const companyId = b?.company_id ?? "";
  const name = b?.name?.trim() ?? "";
  const alias = b?.alias_email?.trim().toLowerCase() ?? "";
  if (!q1(`SELECT id FROM companies WHERE id = ?`, companyId)) return err("auth.errNotFound", 400, { reason: "company_not_found" });
  if (name.length < 2) return err("auth.errGeneric", 400, { reason: "name_required" });
  if (!/^[^@\s]+@[^@\s]+$/.test(alias)) return err("auth.errGeneric", 400, { reason: "alias_invalid" });
  if (q1(`SELECT id FROM newsletter_sources WHERE alias_email = ?`, alias)) {
    return err("auth.errGeneric", 409, { reason: "alias_exists" });
  }

  const id = nextId("source", "newsletter_sources");
  run(
    `INSERT INTO newsletter_sources
      (id, company_id, name, alias_email, market, language, subscription_type, status, source_confidence, created_at)
     VALUES (?, ?, ?, ?, 'DK', ?, 'direct_public_signup', 'active', ?, ?)`,
    id, companyId, name, alias, b?.language ?? "da",
    b?.source_confidence ?? "direct_subscription", nowIso()
  );
  logAudit(auth.user.id, "source.registered", "newsletter_source", id, { alias });
  return json({ ok: true, id });
}
