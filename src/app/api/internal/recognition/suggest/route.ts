import { requireRole, json, err, body, EDITORIAL } from "@/lib/api";
import { q, q1 } from "@/lib/db";
import { storeSuggestion, suggestRecognition } from "@/lib/recognition";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/recognition/suggest (§19)
 * Body: { offer_version_id? } — one version or all published versions.
 * The engine only SUGGESTS; public recognition requires human verification.
 */
export async function POST(request: Request) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;
  const b = await body<{ offer_version_id?: string }>(request);

  const targets = b?.offer_version_id
    ? [b.offer_version_id]
    : q<{ id: string }>(
        `SELECT ov.id FROM offer_versions ov
          WHERE ov.publication_status = 'published' AND ov.verification_status = 'verified'`
      ).map((r) => r.id);

  const results: { offer_version_id: string; status: string | null; preview?: unknown }[] = [];
  for (const vid of targets) {
    const s = storeSuggestion(vid, auth.user.id);
    results.push({ offer_version_id: vid, status: s?.status ?? null, preview: s?.dimensions });
  }
  return json({ ok: true, count: results.length, results });
}
