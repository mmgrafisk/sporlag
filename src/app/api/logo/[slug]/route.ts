import { NextResponse } from "next/server";
import { companyBySlug, ensureCompanyLogo, resolveLogoSrc } from "@/lib/logos";

export const dynamic = "force-dynamic";

/** GET /api/logo/:slug — return cached logo, fetching from the company website if needed. */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const company = companyBySlug(slug);
  let src = resolveLogoSrc(slug, company?.logo_path ?? null);
  if (company && src.endsWith(".svg")) {
    src = await ensureCompanyLogo({
      slug: company.slug,
      name: company.name,
      website: company.website,
      companyId: company.id,
    });
  }
  return NextResponse.redirect(new URL(src, request.url));
}
