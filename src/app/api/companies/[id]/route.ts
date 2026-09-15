import { getCompanyProfile, listPublishedOffers } from "@/lib/queries";
import { companyClarity } from "@/lib/aggregation";
import { q1 } from "@/lib/db";
import { json, err } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/companies/:id — public projection (id or slug). No raw data. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company = q1<{ id: string; slug: string }>(
    `SELECT id, slug FROM companies WHERE (id = ? OR slug = ?) AND status = 'active'`, id, id
  );
  if (!company) return err("auth.errNotFound", 404);
  const profile = getCompanyProfile(company.slug);
  if (!profile) return err("auth.errNotFound", 404);
  return json({
    company: {
      id: profile.id, name: profile.name, slug: profile.slug,
      market: profile.market, category: profile.category,
      stats: profile.stats,
      clarity: companyClarity(profile.id),
      sources: profile.sources.map((s) => ({ name: s.name, language: s.language, status: s.status })),
      offers: listPublishedOffers({ companySlug: profile.slug }).map((o) => ({
        offer_id: o.offer_id, claim: o.claim_original, version: o.version,
        observed_at: o.observed_at, offer_type: o.offer_type,
      })),
    },
  });
}
