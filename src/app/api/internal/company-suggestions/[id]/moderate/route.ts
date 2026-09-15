import { requireRole, json, err, body, ADMIN } from "@/lib/api";
import { q1, run, nowIso } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { insertCompanyRecord, ensureCompanyLogo } from "@/lib/logos";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/company-suggestions/:id/moderate (§15)
 * Body: { action: "approve" | "reject" | "duplicate", matched_company_id? }
 * Approved suggestions create a company record — never auto-published content.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, ADMIN);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const b = await body<{ action?: string; matched_company_id?: string }>(request);
  const action = b?.action;
  if (action !== "approve" && action !== "reject" && action !== "duplicate") {
    return err("auth.errGeneric", 400);
  }

  const sug = q1<{ id: string; company_name: string; status: string }>(
    `SELECT * FROM company_suggestions WHERE id = ?`, id
  );
  if (!sug) return err("auth.errNotFound", 404);
  if (sug.status !== "pending") return err("auth.errGeneric", 409, { reason: "already_moderated" });

  let matchedCompanyId: string | null = b?.matched_company_id ?? null;
  if (action === "approve") {
    const created = insertCompanyRecord({ name: sug.company_name });
    matchedCompanyId = created.id;
    await ensureCompanyLogo({
      slug: created.slug,
      name: sug.company_name,
      website: created.website,
      companyId: created.id,
    });
  }

  run(
    `UPDATE company_suggestions SET status = ?, matched_company_id = ?, moderated_by = ?, moderated_at = ? WHERE id = ?`,
    action === "approve" ? "approved" : action, matchedCompanyId, auth.user.id, nowIso(), id
  );
  logAudit(auth.user.id, "suggestion.moderated", "company_suggestion", id, { action, matched_company_id: matchedCompanyId });
  return json({ ok: true, company_id: matchedCompanyId });
}
