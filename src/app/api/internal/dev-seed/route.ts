import { requireRole, json, ADMIN } from "@/lib/api";
import { runSeedPipeline } from "@/lib/seed";
import { q1 } from "@/lib/db";
import { originAllowed } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/dev-seed — validation seed (admin only).
 * Runs the FULL chain (§20 MASTER) with real domain code:
 * ingest → extract → review → match → versions → publish → community → recognition.
 *
 * First-run bootstrap: when the database has NO users yet (fresh install),
 * the seed may run once without auth to create the demo accounts. As soon as
 * any user exists, the admin role is enforced.
 */
export async function POST(request: Request) {
  if (!originAllowed(request)) return json({ error: "auth.errCsrf" }, 403);
  const freshDb = (q1<{ n: number }>(`SELECT COUNT(*) AS n FROM users`)?.n ?? 0) === 0;
  if (!freshDb) {
    const auth = await requireRole(request, ADMIN);
    if ("error" in auth) return auth.error;
  }
  const res = runSeedPipeline();
  return json(res);
}
