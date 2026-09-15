import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, makeT } from "@/lib/i18n";
import { currentUser, EDITORIAL_ROLES } from "@/lib/auth";
import { getMessagePrivate, getExtractionsForMessage, getExtractionFields, getMatchCandidates } from "@/lib/queries";
import { fmtFieldValue, fmtDate } from "@/lib/format";
import { EXTRACTOR_VERSION } from "@/lib/extractor";
import StudioMessage, { type StudioExtraction } from "@/components/StudioMessage";

export const dynamic = "force-dynamic";

/** Review Studio split screen (§10 BUILD SPEC / §21 DESIGN). */
export default async function StudioMessagePage({ params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const locale = await getLocale();
  const t = makeT(locale);
  const user = await currentUser();
  if (!user) redirect(`/konto?next=${encodeURIComponent(`/studie/beskeder/${messageId}`)}`);
  if (!EDITORIAL_ROLES.includes(user.role)) redirect("/studie");

  const m = getMessagePrivate(messageId);
  if (!m) notFound();

  const extractions: StudioExtraction[] = getExtractionsForMessage(messageId).map((ex) => {
    const fields = getExtractionFields(ex.id).map((f) => ({
      id: f.id,
      field: f.field,
      label: t(`field.${f.field}`),
      valueFmt: fmtFieldValue(JSON.parse(f.value_json), locale),
      valueJson: JSON.parse(f.value_json),
      evidence_span: f.evidence_span,
      locator: { start: f.locator_start, end: f.locator_end },
      confidence: f.confidence,
      extractor_version: f.extractor_version,
      verification_status: f.verification_status,
    }));
    const match_candidates = getMatchCandidates(ex.id).map((mc) => ({
      id: mc.id,
      candidate_offer_id: mc.candidate_offer_id,
      confidence: mc.confidence,
      reason_codes: JSON.parse(mc.reason_codes_json) as string[],
      changed_fields: JSON.parse(mc.changed_fields_json) as string[],
      reviewer_decision: mc.reviewer_decision,
      claim_original: mc.claim_original,
      version: mc.version,
    }));
    return {
      id: ex.id,
      offer_type: ex.offer_type,
      headline: ex.headline,
      claim_original: ex.claim_original,
      status: ex.status,
      is_offer: !!ex.is_offer,
      fields,
      match_candidates,
    };
  });

  const reasonKeys = [
    "same_company", "same_offer_type", "claim_semantic_match", "claim_partial_match",
    "same_intro_period", "same_advertised_price", "price_differs", "temporal_proximity", "distant_last_seen",
  ];

  return (
    <div>
      <p className="small muted mb-1">
        <Link href="/studie">← {t("studio.title")}</Link>
      </p>
      <div className="flex justify-between flex-wrap gap-2 items-center mb-1">
        <h1 style={{ fontSize: "clamp(1.4rem,2.6vw,1.9rem)" }}>
          {m.company_name} <span className="mono muted">· {m.source_name}</span>
        </h1>
        <span className="doc-id">{m.id} · {fmtDate(m.received_at, locale)}</span>
      </div>
      <p className="small muted mb-2">
        {t("studio.subjectLabel")}: <em>{m.subject_private}</em> · {EXTRACTOR_VERSION}
      </p>

      <StudioMessage
        message={{
          id: m.id,
          subject: m.subject_private,
          text: m.body_normalized_private,
          state: m.state,
          source_name: m.source_name,
          company_name: m.company_name,
          received_at: fmtDate(m.received_at, locale),
          fingerprint: m.content_fingerprint,
          links: JSON.parse(m.links_json),
        }}
        extractions={extractions}
        stateLabel={t(`enum.messageState.${m.state}`)}
        reasonLabels={Object.fromEntries(reasonKeys.map((k) => [k, t(`reason.${k}`)]))}
        labels={{
          sourcePane: t("studio.sourcePane"),
          extractionPane: t("studio.extractionPane"),
          privateNotice: t("studio.privateNotice"),
          clickHint: t("studio.clickHint"),
          subjectLabel: t("studio.subjectLabel"),
          linksLabel: t("studio.linksLabel"),
          confirm: t("studio.actions.confirm"),
          edit: t("studio.actions.edit"),
          unknown: t("studio.actions.unknown"),
          saved: t("studio.actions.saved"),
          offerActions: t("studio.offerActions"),
          actNotAnOffer: t("studio.offerActions.notAnOffer"),
          duplicateHint: t("studio.duplicateHint"),
          matchTitle: t("studio.matchTitle"),
          matchRun: t("studio.matchRun"),
          matchNone: t("studio.matchNone"),
          matchConfidence: t("studio.matchConfidence"),
          matchAccept: t("studio.matchAccept"),
          matchReject: t("studio.matchReject"),
          mergeLabel: t("studio.offerActions.merge"),
          splitLabel: t("studio.offerActions.split"),
          matchOverrideNote: t("studio.matchOverrideNote"),
          reasonCodes: t("studio.reasonCodes"),
          changedFields: t("studio.changedFields"),
          changedFieldsNote: t("studio.changedFields"),
          matchDone: t("studio.matchDone"),
          commitTitle: t("studio.commitTitle"),
          commitVerify: t("studio.commitVerify"),
          commitVerified: t("studio.commitVerified"),
          commitVersion: t("studio.commitVersion"),
          commitNewOffer: t("studio.commitNewOffer"),
          commitDone: t("studio.commitDone"),
          allFieldsRequired: t("studio.allFieldsRequired"),
          publishNote: t("studio.publishNote"),
          extractBtn: t("studio.extractBtn"),
          extracted: t("studio.extracted"),
          noExtractions: t("studio.noExtractions"),
          confidenceLabel: t("studio.confidenceLabel"),
          verifiedMark: t("studio.verifiedMark"),
          pendingMark: t("studio.pendingMark"),
          notAnOfferMark: t("studio.notAnOfferMark"),
          candidateLabel: t("studio.candidateLabel"),
          opFailed: t("studio.opFailed"),
          verifiedNow: t("studio.verifiedNow"),
          correctionSaved: t("studio.correctionSaved"),
          decidedAccept: t("studio.decidedAccept"),
          decidedReject: t("studio.decidedReject"),
          willMerge: t("studio.willMerge"),
          editDialogTitle: t("studio.editDialogTitle"),
          editValue: t("studio.editValue"),
          editHint: t("studio.editHint"),
          correctionNote: t("studio.correctionNote"),
          evidenceLabel: t("common.evidence"),
          save: t("common.save"),
          cancel: t("common.cancel"),
          extractorVersion: EXTRACTOR_VERSION,
        }}
      />
    </div>
  );
}
