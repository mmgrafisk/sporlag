import type { Metadata } from "next";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { getLocale, makeT, type Locale } from "@/lib/i18n";
import { getBrand } from "@/lib/brand";
import { currentUser } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = getBrand();
  return {
    title: { default: `${brand.name} — ${brand.tagline}`, template: `%s — ${brand.name}` },
    description:
      "Se hvad virksomheder lovede, hvad der faktisk gjaldt, og hvad der ændrede sig. Levende kommerciel evidens for det danske marked.",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale: Locale = await getLocale();
  const t = makeT(locale);
  const brand = getBrand();
  const user = await currentUser();

  return (
    <html lang={locale === "da-DK" ? "da" : "en"}>
      <body>
        <a className="skip-link" href="#main">{t("a11y.skipLink")}</a>
        <SiteHeader
          brandName={brand.name}
          locale={locale}
          user={user ? { name: user.name, role: user.role } : null}
          labels={{
            nav: {
              explore: t("nav.explore"),
              companies: t("nav.companies"),
              pulse: t("nav.pulse"),
              methodology: t("nav.methodology"),
              about: t("nav.about"),
              dashboard: t("nav.dashboard"),
              newsletters: t("nav.newsletters"),
              reviews: t("nav.reviews"),
              contributions: t("nav.contributions"),
              studio: t("nav.studio"),
              admin: t("nav.admin"),
              login: t("nav.login"),
              logout: t("nav.logout"),
              menu: t("nav.menu"),
              openMenu: t("a11y.openMenu"),
              closeMenu: t("a11y.closeMenu"),
              mainNav: t("a11y.mainNav"),
            },
          }}
        />
        <main id="main">{children}</main>
        <SiteFooter
          brandName={brand.name}
          brandTagline={brand.tagline}
          locale={locale}
          labels={{
            colophon: t("footer.colophon"),
            exploreCol: t("footer.exploreCol"),
            accountCol: t("footer.accountCol"),
            aboutCol: t("footer.aboutCol"),
            privacy: t("footer.privacy"),
            privacyText: t("footer.privacyText"),
            brandStatus: t("footer.brandStatus"),
            workingName: t("common.workingName", { name: brand.name }),
            methodology: t("nav.methodology"),
            pulse: t("nav.pulse"),
            companies: t("nav.companies"),
            explore: t("nav.explore"),
            about: t("nav.about"),
            newsletters: t("nav.newsletters"),
            reviews: t("nav.reviews"),
            contributions: t("nav.contributions"),
            dashboard: t("nav.dashboard"),
            login: t("nav.login"),
          }}
        />
      </body>
    </html>
  );
}
