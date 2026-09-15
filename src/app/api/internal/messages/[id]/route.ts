import { requireRole, json, err, EDITORIAL } from "@/lib/api";
import { getMessagePrivate } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/internal/messages/:id — PRIVATE payload for Review Studio only
 * (editorial roles). Never exposed through consumer APIs (§21/§27).
 * Body is the NORMALIZED text — raw HTML is stored but not served for
 * rendering, so newsletter scripts can never execute in the Studio.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const m = getMessagePrivate(id);
  if (!m) return err("auth.errNotFound", 404);
  return json({
    message: {
      id: m.id,
      source_id: m.source_id,
      source_name: m.source_name,
      company_name: m.company_name,
      received_at: m.received_at,
      subject_private: m.subject_private,
      body_normalized_private: m.body_normalized_private,
      links: JSON.parse(m.links_json),
      state: m.state,
      content_fingerprint: m.content_fingerprint,
    },
  });
}
