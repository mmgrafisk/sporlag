import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, makeT } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { userSelections, listAvailableSources } from "@/lib/queries";
import { fmtDateShort } from "@/lib/format";
import NewsletterManager from "@/components/NewsletterManager";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: makeT(locale)("newsletters.title") };
}

/** Mine nyhedsbreve (§17 DESIGN): calm and personal. */
export default async function MyNewslettersPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const user = await currentUser();
  if (!user) redirect(`/konto?next=${encodeURIComponent("/mine-nyhedsbreve")}`);

  const selections = userSelections(user.id).map((s) => ({
    ...s,
    last_observed_fmt: s.last_observed ? fmtDateShort(s.last_observed, locale) : "—",
    last_change_fmt: s.last_change ? fmtDateShort(s.last_change, locale) : "—",
  }));

  const available = listAvailableSources();

  return (
    <div className="wrap section" style={{ paddingTop: "clamp(2rem,5vw,3.5rem)" }}>
      <span className="chapter-no">01</span>
      <h1>{t("newsletters.title")}</h1>
      <p className="deck mt-1 mb-4">{t("newsletters.intro")}</p>

      <NewsletterManager
        selections={selections}
        available={available}
        labels={{
          selectedTitle: t("newsletters.selectedTitle"),
          availableTitle: t("newsletters.availableTitle"),
          searchPlaceholder: t("newsletters.searchPlaceholder"),
          colCompany: t("newsletters.colCompany"),
          colPending: t("newsletters.colPending"),
          colLastChange: t("newsletters.colLastChange"),
          colLastObserved: t("newsletters.colLastObserved"),
          reviewBtn: t("newsletters.reviewBtn"),
          removeBtn: t("newsletters.removeBtn"),
          addBtn: t("newsletters.addBtn"),
          empty: t("newsletters.empty"),
          noSearchResults: t("newsletters.noSearchResults"),
          suggestTitle: t("newsletters.suggestTitle"),
          suggestIntro: t("newsletters.suggestIntro"),
          suggestName: t("newsletters.suggestName"),
          suggestNote: t("newsletters.suggestNote"),
          suggestBtn: t("newsletters.suggestBtn"),
          suggestSuccess: t("newsletters.suggestSuccess"),
          suggestDupe: t("newsletters.suggestDupe"),
          errorGeneric: t("auth.errGeneric"),
        }}
      />
    </div>
  );
}
