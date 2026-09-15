import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, makeT } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Internal admin area — admin role only, enforced server-side (§22). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = makeT(locale);
  const user = await currentUser();
  if (!user) redirect(`/konto?next=${encodeURIComponent("/admin")}`);
  if (user.role !== "admin") {
    return (
      <div className="wrap section">
        <div className="notice" data-tone="error">{t("auth.errForbidden")}</div>
      </div>
    );
  }

  const links = [
    ["/admin", t("admin.title")],
    ["/admin/kilder", t("admin.navSources")],
    ["/admin/beskeder", t("admin.navMessages")],
    ["/admin/publicering", t("admin.navPublish")],
    ["/admin/anerkendelse", t("admin.navRecognition")],
    ["/admin/foresla", t("admin.navSuggestions")],
    ["/admin/audit", t("admin.navAudit")],
    ["/admin/konfiguration", t("admin.navConfig")],
  ];

  return (
    <div className="wrap-wide section" style={{ paddingTop: "clamp(1.5rem,4vw,2.5rem)" }}>
      <span className="mono" style={{ color: "var(--oxide)" }}>INTERNAL · ADMIN</span>
      <nav className="flex gap-1 flex-wrap mt-2 mb-3" aria-label={t("admin.title")}
        style={{ borderBottom: "2px solid var(--ink)", paddingBottom: "0.9rem" }}>
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="chip" style={{ minHeight: 36 }}>{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
