import { requireRole, json, err, body, ADMIN } from "@/lib/api";
import { insertCompanyRecord, ensureCompanyLogo } from "@/lib/logos";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** POST /api/internal/companies — create a company and fetch its logo. */
export async function POST(request: Request) {
  const auth = await requireRole(request, ADMIN);
  if ("error" in auth) return auth.error;

  const b = await body<{ name?: string; slug?: string; category?: string; website?: string }>(request);
  const name = b?.name?.trim() ?? "";
  if (name.length < 2 || name.length > 120) return err("auth.errGeneric", 400, { reason: "name_required" });

  const created = insertCompanyRecord({
    name,
    slug: b?.slug?.trim() || undefined,
    category: b?.category?.trim() || null,
    website: b?.website?.trim() || null,
  });
  const logo = await ensureCompanyLogo({
    slug: created.slug,
    name,
    website: created.website,
    companyId: created.id,
  });
  logAudit(auth.user.id, "company.created", "company", created.id, { slug: created.slug, logo });
  return json({ ok: true, id: created.id, slug: created.slug, logo });
}
