import { requireRole, json, err, body, EDITORIAL } from "@/lib/api";
import { q1, run } from "@/lib/db";
import { nowIso } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/match-candidates/:id/decision (§11)
 * Reviewer accept / override. Overrides are stored — false merges are
 * tracked aggressively (data asset quality §7 MASTER).
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const b = await body<{ decision?: string }>(request);
  const decision = b?.decision;
  if (decision !== "accept" && decision !== "reject") return err("auth.errGeneric", 400);

  const mc = q1<{ id: string; reviewer_decision: string | null }>(
    `SELECT id, reviewer_decision FROM match_candidates WHERE id = ?`, id
  );
  if (!mc) return err("auth.errNotFound", 404);

  run(
    `UPDATE match_candidates SET reviewer_decision = ?, reviewer_id = ?, decided_at = ? WHERE id = ?`,
    decision, auth.user.id, nowIso(), id
  );
  logAudit(auth.user.id, decision === "accept" ? "match.accepted" : "match.overridden",
    "match_candidate", id, { decision });
  return json({ ok: true });
}
