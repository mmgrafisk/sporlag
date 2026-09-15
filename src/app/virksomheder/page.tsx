import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, makeT } from "@/lib/i18n";
import { listCompanies } from "@/lib/queries";
import { fmtDateShort, fmtNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: makeT(locale)("company.title") };
}

/** Companies index — documented coverage, no rankings, no trust scores. */
export default async function CompaniesPage() {
  const locale = await getLocale();
  const t = makeT(locale);
  const companies = listCompanies();
  const covered = companies.filter((c) => c.published_offers > 0);
  const rest = companies.filter((c) => c.published_offers === 0);

  const row = (c: (typeof companies)[number]) => (
    <li key={c.id} style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem",
      padding: "0.9rem 0", borderBottom: "1px solid var(--line)", flexWrap: "wrap",
    }}>
      <span>
        <Link href={`/virksomheder/${c.slug}`} style={{ fontWeight: 650, color: "var(--ink)", textDecoration: "none", fontSize: "1.05rem" }}>
          {c.name}
        </Link>
        {c.category && <span className="mono muted"> · {c.category.toUpperCase()}</span>}
      </span>
      <span className="mono muted">
        {c.published_offers > 0
          ? `${fmtNumber(c.published_offers, locale)} ${t("common.offers").toLowerCase()} · ${c.last_observed ? fmtDateShort(c.last_observed, locale) : "—"}`
          : "—"}
      </span>
    </li>
  );

  return (
    <div className="wrap section" style={{ paddingTop: "clamp(2rem,5vw,3.5rem)" }}>
      <span className="chapter-no">01</span>
      <h1>{t("company.title")}</h1>
      <p className="deck mt-1 mb-3">{t("company.intro")}</p>

      <h2 className="mb-1" style={{ fontSize: "1.3rem" }}>{t("company.coverage")}</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, maxWidth: "48rem" }}>
        {covered.map(row)}
      </ul>

      {rest.length > 0 && (
        <>
          <h2 className="mt-4 mb-1" style={{ fontSize: "1.3rem" }}>{t("admin.navSources")}</h2>
          <p className="small muted">{t("company.coverageNote")}</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, maxWidth: "48rem" }}>
            {rest.map(row)}
          </ul>
        </>
      )}
    </div>
  );
}
