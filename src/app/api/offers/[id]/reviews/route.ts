import { requireUser, json, err, body, contributionAllowed } from "@/lib/api";
import { getPublishedOffer } from "@/lib/queries";
import { recordObservations } from "@/lib/aggregation";

export const dynamic = "force-dynamic";

/**
 * POST /api/offers/:id/reviews (§16)
 * Structured factual responses against the latest published version.
 * Rate limited; duplicate answers per user/version/question are ignored
 * (UNIQUE constraint) — duplicate protection §27.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (!contributionAllowed(request, auth.user)) return err("auth.errRateLimit", 429);

  const { id } = await ctx.params;
  const offer = getPublishedOffer(id);
  if (!offer) return err("auth.errNotFound", 404);

  const b = await body<{ answers?: Record<string, string> }>(request);
  if (!b?.answers) return err("auth.errGeneric", 400);

  const res = recordObservations(offer.latest.id, auth.user.id, b.answers);
  if (!res.ok) return err(res.error ?? "auth.errGeneric", 400);
  return json({ ok: true, points_awarded: res.pointsAwarded });
}
