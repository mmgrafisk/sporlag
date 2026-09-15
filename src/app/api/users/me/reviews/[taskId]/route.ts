import { requireUser, json, err, body, contributionAllowed } from "@/lib/api";
import { reviewTaskById, contributionProfile } from "@/lib/queries";
import { recordObservations } from "@/lib/aggregation";

export const dynamic = "force-dynamic";

/** POST /api/users/me/reviews/:taskId — complete one structured review (§16). */
export async function POST(request: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (!contributionAllowed(request, auth.user)) return err("auth.errRateLimit", 429);

  const { taskId } = await ctx.params;
  const task = reviewTaskById(taskId, auth.user.id);
  if (!task) return err("auth.errNotFound", 404);
  if (task.status !== "open") return err("auth.errGeneric", 409, { reason: "already_completed" });

  const b = await body<{ answers?: Record<string, string> }>(request);
  if (!b?.answers) return err("auth.errGeneric", 400);

  const res = recordObservations(task.offer_version_id, auth.user.id, b.answers);
  if (!res.ok) return err(res.error ?? "auth.errGeneric", 400);
  return json({ ok: true, points_awarded: res.pointsAwarded, profile: contributionProfile(auth.user.id) });
}
