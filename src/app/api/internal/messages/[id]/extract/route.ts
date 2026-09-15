import { requireRole, json, err, EDITORIAL } from "@/lib/api";
import { runExtraction } from "@/lib/ingest";

export const dynamic = "force-dynamic";

/** POST /api/internal/messages/:id/extract — run the extractor (§9). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const res = runExtraction(id);
  if (!res.ok) return err(res.error ?? "auth.errGeneric", 400);
  return json({ ok: true, extraction_count: res.extractionCount });
}
