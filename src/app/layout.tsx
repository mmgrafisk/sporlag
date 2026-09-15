import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { getLocale, makeT, type Locale } from "@/lib/i18n";
import { getBrand } from "@/lib/brand";
import { currentUser } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const display = localFont({
  src: "../fonts/source-serif-4-latin-wght-normal.woff2",
  weight: "200 900",
  display: "swap",
  variable: "--font-source-serif",
  adjustFontFallback: "Times New Roman",
});

const ui = localFont({
  src: "../fonts/instrument-sans-latin-wght-normal.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-instrument",
  adjustFontFallback: "Arial",
});

const mono = localFont({
  src: "../fonts/ibm-plex-mono-latin-400-normal.woff2",
  weight: "400",
  display: "swap",
  variable: "--font-plex-mono",
  adjustFontFallback: false,
});

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#F7F5F0",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export async function generateMetadata(): Promise<Metadata> {
  const brand = getBrand();
  const description =
    "Se hvad virksomheder lovede, hvad der faktisk gjaldt, og hvad der ændrede sig. Levende kommerciel evidens for det danske marked.";
  return {
    title: { default: `${brand.name} — ${brand.tagline}`, template: `%s — ${brand.name}` },
    description,
    metadataBase: new URL(brand.publicUrl || "http://localhost:3000"),
    openGraph: {
      title: `${brand.name} — ${brand.tagline}`,
      description,
      locale: "da_DK",
      type: "website",
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale: Locale = await getLocale();
  const t = makeT(locale);
  const brand = getBrand();
  const user = await currentUser();

  return (
    <html
      lang={locale === "da-DK" ? "da" : "en"}
      className={`${display.variable} ${ui.variable} ${mono.variable}`}
    >
      <body>
        <a className="skip-link" href="#main">{t("a11y.skipLink")}</a>
        <SiteHeader
          brandName={brand.name}
          brandTagline={brand.tagline}
          locale={locale}
          user={user ? { name: user.name, role: user.role } : null}
          labels={{
            nav: {
              home: t("nav.home"),
              explore: t("nav.offers"),
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
              signup: t("nav.signup"),
              search: t("common.search"),
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
