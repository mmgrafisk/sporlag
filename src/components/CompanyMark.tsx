"use client";

import { useState } from "react";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.replace(/[^A-Za-z0-9ÆØÅæøå]/g, "").slice(0, 2) || "?").toUpperCase();
}

/** Company brand mark — cached file from /logos, with initials fallback. */
export default function CompanyMark(props: {
  name: string;
  slug: string;
  size?: number;
  src?: string | null;
}) {
  const size = props.size ?? 40;
  const [failed, setFailed] = useState(false);
  const src = props.src || `/logos/${props.slug}.svg`;

  if (failed) {
    return (
      <span
        className="company-mark company-mark-fallback"
        style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
        aria-hidden="true"
      >
        {initialsOf(props.name)}
      </span>
    );
  }

  return (
    <span className="company-mark" style={{ width: size, height: size }} aria-hidden="true">
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
