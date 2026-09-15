/** Audit trail (§27): editorial changes and publications are logged. */
import { run, nextId, nowIso } from "./db";

export type AuditAction =
  | "source.registered"
  | "message.ingested"
  | "message.state_changed"
  | "extraction.created"
  | "extraction.field_confirmed"
  | "extraction.field_edited"
  | "extraction.field_unknown"
  | "extraction.verified"
  | "extraction.rejected"
  | "extraction.not_an_offer"
  | "match.suggested"
  | "match.accepted"
  | "match.overridden"
  | "offer.created"
  | "version.created"
  | "version.published"
  | "recognition.suggested"
  | "recognition.verified"
  | "suggestion.created"
  | "suggestion.moderated"
  | "community.observation"
  | "newsletter.selected"
  | "newsletter.removed"
  | "brand.config_changed"
  | "seed.run";

export function logAudit(
  actorId: string | null,
  action: AuditAction | string,
  entityType: string,
  entityId: string,
  detail: Record<string, unknown> = {}
) {
  run(
    `INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    nextId("audit", "audit_log"),
    actorId,
    action,
    entityType,
    entityId,
    JSON.stringify(detail),
    nowIso()
  );
}
