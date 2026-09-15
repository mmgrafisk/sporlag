import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, makeT } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import AuthForms from "@/components/AuthForms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: makeT(locale)("nav.account") };
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = makeT(locale);
  const user = await currentUser();
  if (user) redirect(sp.next ?? "/mit-overblik");

  return (
    <div className="wrap section" style={{ paddingTop: "clamp(2rem,5vw,3.5rem)" }}>
      <span className="chapter-no">01</span>
      <h1>{t("nav.account")}</h1>
      <p className="deck mt-1 mb-3">{t("account.requireLogin")}</p>
      {sp.msg === "loggedout" && <div className="alert-ok" style={{ maxWidth: "28rem" }} role="status">{t("account.loggedOut")}</div>}
      <AuthForms
        next={sp.next}
        labels={{
          loginTitle: t("account.loginTitle"),
          signupTitle: t("account.signupTitle"),
          email: t("account.email"),
          password: t("account.password"),
          passwordHint: t("account.passwordHint"),
          name: t("account.name"),
          loginBtn: t("account.loginBtn"),
          signupBtn: t("account.signupBtn"),
          error: t("account.error"),
          signupError: t("account.signupError"),
          demoNote: t("account.demoNote"),
        }}
      />
    </div>
  );
}
