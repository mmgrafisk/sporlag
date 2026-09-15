"use client";

/**
 * Consumer masthead — wordmark, public nav, search, locale, account.
 * Compact on desktop; full-screen drawer on small screens.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { List, X, MagnifyingGlass } from "@phosphor-icons/react";
import type { Role } from "@/lib/auth";
import type { Locale } from "@/lib/i18n";
import BrandMark from "@/components/BrandMark";

type Props = {
  brandName: string;
  brandTagline: string;
  locale: Locale;
  user: { name: string; role: Role } | null;
  labels: {
    nav: Record<string, string>;
  };
};

const EDITORIAL: Role[] = ["ambassador", "editor", "admin"];

export default function SiteHeader({ brandName, brandTagline, locale, user, labels }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = labels.nav;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const setLocale = (next: Locale) => {
    const secure = typeof window !== "undefined" && window.location.protocol === "https:";
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=${secure ? "none" : "lax"}${secure ? "; secure" : ""}`;
    router.refresh();
  };

  const publicLinks = [
    { href: "/", label: nav.home, exact: true },
    { href: "/udforsk", label: nav.explore },
    { href: "/virksomheder", label: nav.companies },
    { href: "/mine-nyhedsbreve", label: nav.newsletters },
    { href: "/markedspulsen", label: nav.pulse },
    { href: "/om", label: nav.about },
  ];
  const accountLinks = user
    ? [
        { href: "/mit-overblik", label: nav.dashboard },
        { href: "/vurderinger", label: nav.reviews },
        ...(EDITORIAL.includes(user.role) ? [{ href: "/studie", label: nav.studio }] : []),
        ...(user.role === "admin" ? [{ href: "/admin", label: nav.admin }] : []),
      ]
    : [];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const logout = () => {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => {
      setOpen(false);
      router.push("/");
      router.refresh();
    });
  };

  const localeSwitch = (
    <div className="locale-switch" role="group" aria-label="Sprog / Language">
      <button type="button" data-active={locale === "da-DK" ? "true" : undefined} onClick={() => setLocale("da-DK")}>DA</button>
      <button type="button" data-active={locale === "en" ? "true" : undefined} onClick={() => setLocale("en")}>EN</button>
    </div>
  );

  return (
    <header className="masthead" data-open={open ? "true" : undefined}>
      <div className="wrap-wide masthead-inner">
        <Link href="/" className="wordmark" aria-label={brandName} onClick={() => setOpen(false)}>
          <BrandMark size={36} />
          <span className="wordmark-text">
            <span className="wordmark-name">{brandName}</span>
            <span className="wordmark-tag">{brandTagline}</span>
          </span>
        </Link>

        <nav id="site-nav" className="mainnav" data-open={open ? "true" : "false"} aria-label={nav.mainNav}>
          {publicLinks.map((l) => (
            <Link key={l.href} href={l.href} data-active={isActive(l.href, l.exact) ? "true" : undefined} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          {accountLinks.map((l) => (
            <Link key={l.href} href={l.href} data-active={isActive(l.href) ? "true" : undefined} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div className="nav-drawer-utils">
            {localeSwitch}
            {user ? (
              <button type="button" className="btn btn-quiet" onClick={logout}>{nav.logout}</button>
            ) : (
              <div className="nav-account">
                <Link href="/konto" className="btn btn-quiet" onClick={() => setOpen(false)}>{nav.login}</Link>
                <Link href="/konto?tab=signup" className="btn" onClick={() => setOpen(false)}>{nav.signup}</Link>
              </div>
            )}
          </div>
        </nav>

        <div className="masthead-utils">
          <Link href="/udforsk" className="icon-btn" aria-label={nav.search}>
            <MagnifyingGlass size={22} weight="bold" />
          </Link>
          <span className="masthead-desktop-utils">
            {localeSwitch}
            {user ? (
              <button type="button" className="btn btn-quiet btn-sm" title={user.name} onClick={logout}>
                {nav.logout}
              </button>
            ) : (
              <>
                <Link href="/konto" className="btn btn-quiet btn-sm">{nav.login}</Link>
                <Link href="/konto?tab=signup" className="btn btn-sm">{nav.signup}</Link>
              </>
            )}
          </span>
          <button
            type="button"
            className="icon-btn menu-toggle"
            aria-expanded={open}
            aria-controls="site-nav"
            aria-label={open ? nav.closeMenu : nav.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
          </button>
        </div>
      </div>
      {open && <button type="button" className="nav-scrim" aria-label={nav.closeMenu} onClick={() => setOpen(false)} />}
    </header>
  );
}
