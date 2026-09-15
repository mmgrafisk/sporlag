import { requireUser, json, err } from "@/lib/api";
import { q, q1, run, nextId, nowIso } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** POST — "Jeg modtager deres nyhedsbrev" (§5.5). Backfills open review tasks. */
export async function POST(request: Request, ctx: { params: Promise<{ newsletterId: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const { newsletterId } = await ctx.params;
  const src = q1<{ id: string }>(`SELECT id FROM newsletter_sources WHERE id = ?`, newsletterId);
  if (!src) return err("auth.errNotFound", 404);

  run(
    `INSERT OR IGNORE INTO user_newsletter_selections (user_id, source_id, selected_at) VALUES (?, ?, ?)`,
    auth.user.id, newsletterId, nowIso()
  );
  // Backfill: published versions from this source become review tasks
  const versions = q<{ id: string }>(
    `SELECT ov.id FROM offer_versions ov JOIN messages m ON m.id = ov.message_id
      WHERE m.source_id = ? AND ov.publication_status = 'published'`,
    newsletterId
  );
  for (const v of versions) {
    run(
      `INSERT OR IGNORE INTO review_tasks (id, user_id, offer_version_id, status, created_at)
       VALUES (?, ?, ?, 'open', ?)`,
      nextId("task", "review_tasks"), auth.user.id, v.id, nowIso()
    );
  }
  logAudit(auth.user.id, "newsletter.selected", "newsletter_source", newsletterId, {});
  return json({ ok: true, tasks_created: versions.length });
}

/** DELETE — deselect. */
export async function DELETE(request: Request, ctx: { params: Promise<{ newsletterId: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const { newsletterId } = await ctx.params;
  run(`DELETE FROM user_newsletter_selections WHERE user_id = ? AND source_id = ?`, auth.user.id, newsletterId);
  run(
    `DELETE FROM review_tasks WHERE user_id = ? AND status = 'open' AND offer_version_id IN
      (SELECT ov.id FROM offer_versions ov JOIN messages m ON m.id = ov.message_id WHERE m.source_id = ?)`,
    auth.user.id, newsletterId
  );
  logAudit(auth.user.id, "newsletter.removed", "newsletter_source", newsletterId, {});
  return json({ ok: true });
}
