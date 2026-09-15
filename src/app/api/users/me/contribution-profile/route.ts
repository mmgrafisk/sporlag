import { requireUser, json } from "@/lib/api";
import { contributionProfile, userObservationCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** GET /api/users/me/contribution-profile — points / reputation / impact kept separate (§18). */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const p = contributionProfile(auth.user.id);
  return json({
    contribution_points: p.contribution_points,
    reputation: p.reputation,
    impact_count: p.impact_count,
    reviews_completed: userObservationCount(auth.user.id),
  });
}
