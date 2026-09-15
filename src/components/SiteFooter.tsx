import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import BrandMark from "@/components/BrandMark";

type Props = {
  brandName: string;
  brandTagline: string;
  locale: Locale;
  labels: Record<string, string>;
};

/** Colophon-style footer: editorial, explains the privacy boundary and brand status. */
export default function SiteFooter({ brandName, brandTagline, labels }: Props) {
  return (
    <footer className="colophon">
      <div className="wrap-wide">
        <div className="colophon-grid">
          <div>
            <div className="colophon-brand">
              <BrandMark size={40} />
              <span>{brandName}</span>
            </div>
            <p className="small muted mt-1">{brandTagline}</p>
            <p className="small muted">{labels.colophon}</p>
            <p className="notice small mt-2" style={{ maxWidth: "34rem" }}>
              {labels.privacyText}
            </p>
          </div>
          <div>
            <h4>{labels.exploreCol}</h4>
            <ul>
              <li><Link href="/udforsk">{labels.explore}</Link></li>
              <li><Link href="/virksomheder">{labels.companies}</Link></li>
              <li><Link href="/markedspulsen">{labels.pulse}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{labels.accountCol}</h4>
            <ul>
              <li><Link href="/mit-overblik">{labels.dashboard}</Link></li>
              <li><Link href="/mine-nyhedsbreve">{labels.newsletters}</Link></li>
              <li><Link href="/vurderinger">{labels.reviews}</Link></li>
              <li><Link href="/bidrag">{labels.contributions}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{labels.aboutCol}</h4>
            <ul>
              <li><Link href="/metodologi">{labels.methodology}</Link></li>
              <li><Link href="/om">{labels.about}</Link></li>
              <li><Link href="/privatliv">{labels.privacy}</Link></li>
            </ul>
          </div>
        </div>
        <div className="colophon-bottom">
          <span>© {new Date().getFullYear()} {brandName} · {labels.brandStatus}</span>
          <span className="mono">{labels.workingName}</span>
        </div>
      </div>
    </footer>
  );
}
