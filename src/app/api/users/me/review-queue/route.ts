import { requireUser, json } from "@/lib/api";
import { reviewQueue } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** GET /api/users/me/review-queue — concrete campaigns the user receives (§5.5). */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  return json({
    queue: reviewQueue(auth.user.id).map((r) => ({
      task_id: r.task_id,
      offer_id: r.offer_id,
      offer_version_id: r.offer_version_id,
      version: r.version,
      claim: r.claim_original,
      company: { name: r.company_name, slug: r.company_slug },
      observed_at: r.observed_at,
      fields: JSON.parse(r.fields_json),
    })),
  });
}
