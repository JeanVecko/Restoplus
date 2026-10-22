import type { ReactNode } from "react";

const iconPaths: Record<string, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  menu: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="7" cy="6" r="1" />
      <circle cx="7" cy="12" r="1" />
      <circle cx="7" cy="18" r="1" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M7 16v4m10-4v4M3 10h18" />
    </>
  ),
  order: (
    <>
      <path d="M7 3h10l3 3v15H4V3h3Zm0 0v4h10V3M8 12h8m-8 4h8" />
    </>
  ),
  kitchen: (
    <>
      <path d="M6 13V5a2 2 0 0 1 4 0v8m0-5h4V5a2 2 0 0 1 4 0v8a6 6 0 0 1-12 0Zm6 6v3" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 10h18m-13 5h4m6-7V4" />
    </>
  ),
  stock: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5" />
    </>
  ),
  report: (
    <>
      <path d="M4 20V10m8 10V4m8 16v-7" />
      <path d="M2 20h20" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path
        d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.9Z"
        transform="translate(-1 -1) scale(1.08)"
      />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7a4 4 0 0 1 0 7m2 4a4 4 0 0 1 3 4v2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 5 5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: (
    <>
      <path d="m5 12 4 4L19 6" />
    </>
  ),
};

export function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`rp-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}