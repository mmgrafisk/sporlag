import { listPublishedOffers } from "@/lib/queries";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/offers — public projection: published offers only. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rows = listPublishedOffers({
    companySlug: url.searchParams.get("company") ?? undefined,
    offerType: url.searchParams.get("type") ?? undefined,
    changedOnly: url.searchParams.get("changed") === "1",
  });
  return json({
    offers: rows.map((o) => ({
      offer_id: o.offer_id,
      company: { id: o.company_id, name: o.company_name, slug: o.company_slug },
      offer_type: o.offer_type,
      claim: o.claim_original,
      fields: o.fields,
      version: o.version,
      total_versions: o.total_versions,
      observed_at: o.observed_at,
      changed_fields: o.changed_fields,
      recognition: o.recognition_verified && o.recognition_status ? o.recognition_status : null,
    })),
  });
}
