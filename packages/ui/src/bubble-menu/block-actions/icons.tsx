"use client";

import type { SVGProps } from "react";

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconAlignLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" {...base} strokeWidth="1.4" {...props}>
      <path d="M2 3.5h12M2 8h8M2 12.5h12" />
    </svg>
  );
}

export function IconAlignCenter(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" {...base} strokeWidth="1.4" {...props}>
      <path d="M2 3.5h12M4 8h8M2 12.5h12" />
    </svg>
  );
}

export function IconAlignRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" {...base} strokeWidth="1.4" {...props}>
      <path d="M2 3.5h12M6 8h8M2 12.5h12" />
    </svg>
  );
}

export function IconImage(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" {...base} strokeWidth="1.3" {...props}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="5.5" cy="6.5" r="1" />
      <path d="M3.5 11.5l3-3 2.5 2.5 2-1.5L13 12" />
    </svg>
  );
}

export function IconLink(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" {...base} strokeWidth="1.3" {...props}>
      <path d="M6.5 8.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-1 1" />
      <path d="M9.5 7.5a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5l1-1" />
    </svg>
  );
}

export function IconCaption(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" {...base} strokeWidth="1.3" {...props}>
      <path d="M3 4h10M3 8h6M3 12h8" />
    </svg>
  );
}

export function IconWidth(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" {...base} strokeWidth="1.3" {...props}>
      <path d="M2 8h12M5 5l-3 3 3 3M11 5l3 3-3 3" />
    </svg>
  );
}

export function IconExternal(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" {...base} strokeWidth="1.3" {...props}>
      <path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10" />
      <path d="M9 2h5v5M14 2L8 8" />
    </svg>
  );
}

export function IconEdit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" {...base} strokeWidth="1.3" {...props}>
      <path d="M11.5 2.5l2 2L6 12H4v-2l7.5-7.5z" />
    </svg>
  );
}

export function IconCopy(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" {...base} strokeWidth="1.3" {...props}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 11h1.5" />
    </svg>
  );
}

export function IconUpload(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" {...base} strokeWidth="1.3" {...props}>
      <path d="M8 11V3M5 6l3-3 3 3" />
      <path d="M2.5 10v2.5A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V10" />
    </svg>
  );
}

export function IconDownload(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" {...base} strokeWidth="1.3" {...props}>
      <path d="M8 3v8M5 8l3 3 3-3" />
      <path d="M2.5 10v2.5A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V10" />
    </svg>
  );
}

export function IconColumns(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" {...base} strokeWidth="1.3" {...props}>
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M8 3v10M11 3v10M5 3v10" />
    </svg>
  );
}

export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" {...base} strokeWidth="1.6" {...props}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function IconFormula(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" {...base} strokeWidth="1.3" {...props}>
      <path d="M5 4L3 8l2 4M11 4l2 4-2 4M8 3h3M8 13h3M7 6l2 4" />
    </svg>
  );
}

export function IconChevronRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" {...base} strokeWidth="1.4" {...props}>
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

export function IconList(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" {...base} strokeWidth="1.3" {...props}>
      <path d="M6 3.5h8M6 8h8M6 12.5h8M3 3.5h.01M3 8h.01M3 12.5h.01" />
    </svg>
  );
}

export function IconZoomIn(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" {...base} strokeWidth="1.3" {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14M7 5.5v3M5.5 7h3" />
    </svg>
  );
}
