import { requireRole, json, err, body, EDITORIAL } from "@/lib/api";
import { ingestMessage } from "@/lib/ingest";
import { listMessages } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** GET /api/internal/messages — incoming message list (editorial roles only). */
export async function GET(request: Request) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  return json({ messages: listMessages({ state: url.searchParams.get("state") ?? undefined }) });
}

/**
 * POST /api/internal/messages — safe ingestion (§8/§27):
 * sanitize (scripts stripped), normalize, fingerprint, private raw storage.
 */
export async function POST(request: Request) {
  const auth = await requireRole(request, EDITORIAL);
  if ("error" in auth) return auth.error;

  const b = await body<{
    source_id?: string; subject?: string; raw_html?: string; received_at?: string;
  }>(request);
  if (!b?.source_id || !b.subject || !b.raw_html) return err("auth.errGeneric", 400);
  if (b.raw_html.length > 2_000_000) return err("auth.errGeneric", 413);

  const res = ingestMessage({
    sourceId: b.source_id,
    subject: b.subject,
    rawHtml: b.raw_html,
    receivedAt: b.received_at,
    actorId: auth.user.id,
  });
  if (!res.ok) return err(res.error, 400);
  return json({ ok: true, message_id: res.messageId, duplicate: res.duplicate });
}
