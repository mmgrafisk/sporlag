import { requireRole, json, err, body, EDITORIAL } from "@/lib/api";
import { q1 } from "@/lib/db";
import { commitVersion } from "@/lib/versioning";
import { getExtractionFields } from "@/lib/queries";
import { canonicalIdentity, type ExtractedField } from "@/lib/extractor";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/extractions/:id/commit
 * Body: { matched_offer_id: string|null, working_name?: string }
 * Creates the Offer (+ Campaign if new) and the Offer Version with
 * changed fields (§6/§12). Requires a VERIFIED extraction — the version
 * starts UNPUBLISHED (publication is a separate explicit step, §7).
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const b = await body<{ matched_offer_id?: string | null; working_name?: string }>(request);

  const ex = q1<{ id: string; message_id: string; offer_type: string; headline: string | null; status: string }>(
    `SELECT * FROM extractions WHERE id = ?`, id
  );
  if (!ex) return err("auth.errNotFound", 404);
  const msg = q1<{ received_at: string; source_id: string }>(
    `SELECT received_at, source_id FROM messages WHERE id = ?`, ex.message_id
  );
  if (!msg) return err("auth.errNotFound", 404);
  const src = q1<{ company_id: string }>(
    `SELECT company_id FROM newsletter_sources WHERE id = ?`, msg.source_id
  );
  if (!src) return err("auth.errNotFound", 404);
  const company = q1<{ name: string }>(`SELECT name FROM companies WHERE id = ?`, src.company_id);
  if (!company) return err("auth.errNotFound", 404);

  const fields: ExtractedField[] = getExtractionFields(ex.id).map((f) => ({
    field: f.field, value: JSON.parse(f.value_json), evidence_span: f.evidence_span,
    locator_start: f.locator_start, locator_end: f.locator_end, confidence: f.confidence,
  }));

  const res = commitVersion({
    extractionId: ex.id,
    matchedOfferId: b?.matched_offer_id ?? null,
    reviewerId: auth.user.id,
    canonicalIdentity: canonicalIdentity(company.name, ex.offer_type ?? "other", ex.headline, fields),
    observedAt: msg.received_at,
    workingName: b?.working_name?.trim() || ex.headline || "Kampagne",
  });
  if (!res.ok) return err(res.error ?? "auth.errGeneric", 400);
  return json({
    ok: true,
    offer_id: res.offerId,
    offer_version_id: res.versionId,
    changed_fields: res.changedFields,
    note: "verification_is_not_publication",
  });
}
