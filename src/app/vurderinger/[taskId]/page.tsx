import { notFound, redirect } from "next/navigation";
import { getLocale, makeT } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { reviewTaskById } from "@/lib/queries";
import ReviewFlow from "@/components/ReviewFlow";

export const dynamic = "force-dynamic";

const QUESTION_KEYS = [
  "price_clarity", "period_clarity", "post_intro_clarity", "conditions_visibility",
] as const;
const RESPONSE_VALUES = ["clear", "partial", "unclear", "unknown"] as const;
const OUTCOME_VALUES = ["confirmed", "not_confirmed", "unknown"] as const;

/** Review Flow (§16/§18): one question at a time, ~20 seconds, no stars. */
export default async function ReviewFlowPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const locale = await getLocale();
  const t = makeT(locale);
  const user = await currentUser();
  if (!user) redirect(`/konto?next=${encodeURIComponent(`/vurderinger/${taskId}`)}`);

  const task = reviewTaskById(taskId, user.id);
  if (!task) notFound();
  if (task.status !== "open") redirect("/vurderinger");

  const questions = [
    ...QUESTION_KEYS.map((k) => ({
      key: k,
      label: t(`community.question.${k}`),
      answers: RESPONSE_VALUES.map((v) => ({ value: v, label: t(`enum.response.${v}`) })),
    })),
    {
      key: "worked_as_described",
      label: t("community.question.worked_as_described"),
      answers: OUTCOME_VALUES.map((v) => ({ value: v, label: t(`enum.outcome.${v}`) })),
    },
  ];

  return (
    <div className="wrap">
      <ReviewFlow
        taskId={task.task_id}
        claim={task.claim_original}
        company={task.company_name}
        questions={questions}
        labels={{
          progress: t("reviews.progress"),
          contextTitle: t("reviews.contextTitle"),
          contextNote: t("reviews.contextNote"),
          keyboardHint: t("reviews.keyboardHint"),
          doneTitle: t("reviews.doneTitle"),
          doneBody: t("reviews.doneBody"),
          pointsEarned: t("reviews.pointsEarned"),
          impactNote: t("reviews.impactNote"),
          backToQueue: t("reviews.backToQueue"),
          nextQuestion: t("reviews.nextQuestion"),
          finish: t("reviews.finish"),
          back: t("common.back"),
          contribLink: t("nav.contributions"),
          errGeneric: t("auth.errGeneric"),
        }}
      />
    </div>
  );
}
