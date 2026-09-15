import { requireRole, json, ADMIN } from "@/lib/api";
import { auditTrail } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** GET /api/internal/audit — audit trail (§27), admin only. */
export async function GET(request: Request) {
  const auth = await requireRole(request, ADMIN);
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  const limit = Math.min(500, Number(url.searchParams.get("limit") ?? 200));
  return json({ audit: auditTrail(limit) });
}
