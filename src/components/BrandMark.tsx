/** Layered-document mark — the brand motif (rebrandable, not a lockup of the working name). */
export default function BrandMark(props: { size?: number }) {
  const s = props.size ?? 32;
  return (
    <svg className="brand-mark" width={s} height={s} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="6" y="4" width="20" height="22" rx="3" fill="var(--primary)" opacity="0.28" />
      <rect x="4" y="6" width="20" height="22" rx="3" fill="var(--primary)" opacity="0.55" />
      <rect x="2" y="8" width="20" height="22" rx="3" fill="var(--primary)" />
      <rect x="6" y="13" width="12" height="1.6" rx="0.8" fill="var(--paper)" opacity="0.9" />
      <rect x="6" y="17" width="9" height="1.6" rx="0.8" fill="var(--paper)" opacity="0.7" />
      <rect x="6" y="21" width="6" height="1.6" rx="0.8" fill="var(--signal-lime)" />
    </svg>
  );
}
