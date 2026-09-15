import { requireRole, json, err, EDITORIAL } from "@/lib/api";
import { publishVersion } from "@/lib/versioning";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/offer-versions/:id/publish (§7)
 * EXPLICIT publication transition. Hard guard: only verified versions can
 * ever be published; unverified facts cannot be published accidentally.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const res = publishVersion(id, auth.user.id);
  if (!res.ok) return err(res.error ?? "auth.errGeneric", 400);
  return json({ ok: true });
}
