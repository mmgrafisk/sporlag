import { getPublishedOffer } from "@/lib/queries";
import { json, err } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/offers/:id/community-summary — aggregate + sample size (§17). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const offer = getPublishedOffer(id);
  if (!offer) return err("auth.errNotFound", 404);
  return json({ community: offer.summary });
}
