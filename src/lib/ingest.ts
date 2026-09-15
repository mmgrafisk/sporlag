/**
 * SOURCE INGESTION (§8 BUILD SPEC)
 * P0 source type: legitimate public company marketing newsletters received
 * at platform-controlled aliases. Raw source stays PRIVATE.
 * Pipeline: receive → sanitize/normalize → fingerprint (duplicate protection)
 *           → extract → review.
 */
import { q1, run, nextId, nowIso } from "./db";
import { normalizeMessage, sanitizeHtml } from "./sanitize";
import { extractOffers } from "./extractor";
import { persistExtraction, setMessageState } from "./versioning";
import { logAudit } from "./audit";

export type IngestResult =
  | { ok: true; messageId: string; duplicate: false }
  | { ok: true; messageId: string; duplicate: true; existingMessageId: string }
  | { ok: false; error: string };

export function ingestMessage(opts: {
  sourceId: string;
  subject: string;
  rawHtml: string;
  receivedAt?: string;
  actorId: string | null;
}): IngestResult {
  const src = q1<{ id: string; status: string }>(
    `SELECT id, status FROM newsletter_sources WHERE id = ?`, opts.sourceId
  );
  if (!src) return { ok: false, error: "source_not_found" };

  const { text, links, fingerprint } = normalizeMessage(opts.rawHtml);

  // Duplicate protection (§27): identical normalized content is reviewable, not silently re-processed
  const dupe = q1<{ id: string }>(
    `SELECT id FROM messages WHERE content_fingerprint = ?`, fingerprint
  );
  if (dupe) {
    const dupId = nextId("message", "messages");
    run(
      `INSERT INTO messages
        (id, source_id, received_at, subject_private, body_raw_private, body_normalized_private,
         links_json, headers_min_json, state, content_fingerprint, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '{}', 'DUPLICATE', ?, ?)`,
      dupId, opts.sourceId, opts.receivedAt ?? nowIso(), opts.subject,
      opts.rawHtml, text, JSON.stringify(links), fingerprint, nowIso()
    );
    logAudit(opts.actorId, "message.ingested", "message", dupId, { duplicate_of: dupe.id });
    return { ok: true, messageId: dupId, duplicate: true, existingMessageId: dupe.id };
  }

  const id = nextId("message", "messages");
  run(
    `INSERT INTO messages
      (id, source_id, received_at, subject_private, body_raw_private, body_normalized_private,
       links_json, headers_min_json, state, content_fingerprint, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '{}', 'RECEIVED', ?, ?)`,
    id, opts.sourceId, opts.receivedAt ?? nowIso(), opts.subject,
    sanitizeHtml(opts.rawHtml), text, JSON.stringify(links), fingerprint, nowIso()
  );
  logAudit(opts.actorId, "message.ingested", "message", id, { source_id: opts.sourceId });
  return { ok: true, messageId: id, duplicate: false };
}

/** Run the extractor over a received message (state machine §7). */
export function runExtraction(messageId: string): { ok: boolean; extractionCount: number; error?: string } {
  const msg = q1<{ id: string; body_normalized_private: string; state: string }>(
    `SELECT id, body_normalized_private, state FROM messages WHERE id = ?`, messageId
  );
  if (!msg) return { ok: false, extractionCount: 0, error: "not_found" };
  if (msg.state === "DUPLICATE") return { ok: false, extractionCount: 0, error: "duplicate_message" };

  setMessageState(messageId, "PROCESSING");
  try {
    const candidates = extractOffers(msg.body_normalized_private);
    const ids = persistExtraction(messageId, candidates);
    return { ok: true, extractionCount: ids.length };
  } catch (e) {
    setMessageState(messageId, "FAILED"); // failed extraction must not silently publish (§7)
    logAudit(null, "message.state_changed", "message", messageId, { state: "FAILED", error: String(e) });
    return { ok: false, extractionCount: 0, error: "extraction_failed" };
  }
}
