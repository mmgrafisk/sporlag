"use client";

/**
 * Editorial masthead — wordmark with layer motif (rebrandable: name comes
 * from central brand config), language switch, role-aware nav, mobile menu.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { List, X } from "@phosphor-icons/react";
import type { Role } from "@/lib/auth";
import type { Locale } from "@/lib/i18n";

type Props = {
  brandName: string;
  locale: Locale;
  user: { name: string; role: Role } | null;
  labels: {
    nav: Record<string, string>;
  };
};

const EDITORIAL: Role[] = ["ambassador", "editor", "admin"];

export default function SiteHeader({ brandName, locale, user, labels }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = labels.nav;

  const setLocale = (next: Locale) => {
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=strict`;
    router.refresh();
  };

  const publicLinks = [
    { href: "/udforsk", label: nav.explore },
    { href: "/virksomheder", label: nav.companies },
    { href: "/markedspulsen", label: nav.pulse },
    { href: "/metodologi", label: nav.methodology },
  ];
  const accountLinks = user
    ? [
        { href: "/mit-overblik", label: nav.dashboard },
        { href: "/mine-nyhedsbreve", label: nav.newsletters },
        { href: "/vurderinger", label: nav.reviews },
        ...(EDITORIAL.includes(user.role) ? [{ href: "/studie", label: nav.studio }] : []),
        ...(user.role === "admin" ? [{ href: "/admin", label: nav.admin }] : []),
      ]
    : [];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="masthead">
      <div className="wrap-wide masthead-inner">
        <Link href="/" className="wordmark" aria-label={brandName}>
          <span className="wordmark-layers" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="wordmark-name">{brandName}</span>
        </Link>

        <nav className="mainnav" data-open={open ? "true" : "false"} aria-label={nav.mainNav}>
          {publicLinks.map((l) => (
            <Link key={l.href} href={l.href} data-active={isActive(l.href) ? "true" : undefined} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          {accountLinks.map((l) => (
            <Link key={l.href} href={l.href} data-active={isActive(l.href) ? "true" : undefined} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          {!user && (
            <Link href="/konto" data-active={isActive("/konto") ? "true" : undefined} onClick={() => setOpen(false)}>
              {nav.login}
            </Link>
          )}
        </nav>

        <div className="masthead-utils">
          <div className="locale-switch" role="group" aria-label="Sprog / Language">
            <button type="button" data-active={locale === "da-DK" ? "true" : undefined} onClick={() => setLocale("da-DK")}>DA</button>
            <button type="button" data-active={locale === "en" ? "true" : undefined} onClick={() => setLocale("en")}>EN</button>
          </div>
          {user && (
            <form
              action="/api/auth/logout"
              method="post"
              onSubmit={(e) => {
                e.preventDefault();
                fetch("/api/auth/logout", { method: "POST" }).then(() => {
                  router.push("/");
                  router.refresh();
                });
              }}
            >
              <button type="submit" className="btn btn-quiet btn-sm" title={user.name}>
                {nav.logout}
              </button>
            </form>
          )}
          <button
            type="button"
            className="btn btn-quiet btn-sm menu-toggle"
            aria-expanded={open}
            aria-label={open ? nav.closeMenu : nav.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
          </button>
        </div>
      </div>
    </header>
  );
}
