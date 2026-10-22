import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type IconName =
  | "dashboard"
  | "menu"
  | "table"
  | "order"
  | "kitchen"
  | "cash"
  | "stock"
  | "report"
  | "settings"
  | "search"
  | "bell"
  | "arrow"
  | "clock"
  | "users"
  | "check";

const iconPaths: Record<IconName, ReactNode> = {
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
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7a4 4 0 0 1 0 7m2 4a4 4 0 0 1 3 4v2" />
    </>
  ),
  check: (
    <>
      <path d="m5 12 4 4L19 6" />
    </>
  ),
};

function Icon({
  name,
  className = "",
}: {
  name: IconName;
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

const navigation: {
  label: string;
  href: string;
  icon: IconName;
  active?: boolean;
  count?: string;
}[] = [
  { label: "Tableau de bord", href: "/", icon: "dashboard", active: true },
  { label: "Menus", href: "/menus", icon: "menu" },
  { label: "Tables", href: "/tables", icon: "table" },
  { label: "Commandes", href: "/commandes", icon: "order", count: "7" },
  { label: "Cuisine / Bar", href: "/cuisine", icon: "kitchen", count: "4" },
  { label: "Caisse", href: "/caisse", icon: "cash" },
  { label: "Stocks", href: "/stocks", icon: "stock", count: "2" },
  { label: "Rapports", href: "/rapports", icon: "report" },
];

const shortcuts = [
  {
    label: "Prendre une commande",
    detail: "Démarrer une commande",
    href: "/commandes",
    icon: "order" as const,
    color: "bg-amber-50 text-amber-700",
  },
  {
    label: "Plan des tables",
    detail: "Voir la salle",
    href: "/tables",
    icon: "table" as const,
    color: "bg-blue-50 text-blue-700",
  },
  {
    label: "Cuisine / Bar",
    detail: "Suivre la préparation",
    href: "/cuisine",
    icon: "kitchen" as const,
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    label: "Ouvrir la caisse",
    detail: "Accéder à l’encaissement",
    href: "/caisse",
    icon: "cash" as const,
    color: "bg-violet-50 text-violet-700",
  },
  {
    label: "Gérer les menus",
    detail: "Articles et prix",
    href: "/menus",
    icon: "menu" as const,
    color: "bg-rose-50 text-rose-700",
  },
  {
    label: "Suivre le stock",
    detail: "Niveaux et alertes",
    href: "/stocks",
    icon: "stock" as const,
    color: "bg-cyan-50 text-cyan-700",
  },
  {
    label: "Consulter les rapports",
    detail: "Activité et ventes",
    href: "/rapports",
    icon: "report" as const,
    color: "bg-slate-100 text-slate-700",
  },
];

const demoOrders = [
  {
    number: "CMD-0248",
    table: "Table 04",
    items: "3 articles",
    time: "12 min",
    status: "En préparation",
    tone: "bg-amber-100 text-amber-800",
  },
  {
    number: "CMD-0249",
    table: "Table 08",
    items: "5 articles",
    time: "8 min",
    status: "En préparation",
    tone: "bg-amber-100 text-amber-800",
  },
  {
    number: "CMD-0250",
    table: "À emporter",
    items: "2 articles",
    time: "3 min",
    status: "Nouvelle",
    tone: "bg-blue-100 text-blue-800",
  },
];

const demoKitchen = [
  { label: "À préparer", value: 2, color: "bg-amber-500" },
  { label: "En cours", value: 3, color: "bg-blue-500" },
  { label: "Prêtes", value: 1, color: "bg-emerald-500" },
];

function SectionHeading({
  title,
  detail,
  href,
  linkLabel,
}: {
  title: string;
  detail?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="rp-section-heading mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="rp-section-title text-base font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        {detail && (
          <p className="rp-section-detail mt-1 text-xs text-slate-500">
            {detail}
          </p>
        )}
      </div>
      {href && (
        <Link
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
          href={href}
        >
          {linkLabel ?? "Tout voir"}
          <Icon name="arrow" className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: IconName;
  color: string;
}) {
  return (
    <article className="rp-metric-card rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.02] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="rp-metric-label text-xs font-medium text-slate-500">
            {label}
          </p>
          <p className="rp-metric-value mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {value}
          </p>
          <p className="rp-metric-sub mt-1.5 text-[11px] text-slate-500">
            {sub}
          </p>
        </div>
        <span
          className={`rp-metric-icon flex size-10 shrink-0 items-center justify-center rounded-xl ${color}`}
        >
          <Icon name={icon} className="size-5" />
        </span>
      </div>
    </article>
  );
}

export default function Dashboard() {
  return (
    <div className="rp-dashboard min-h-screen bg-[#f6f7f9] text-slate-900 lg:flex">
      <aside className="rp-sidebar border-b border-slate-200 bg-[#202124] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[248px] lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0 lg:border-white/5">
        <div className="rp-brand flex items-center gap-3 px-4 py-3 lg:px-5 lg:py-5">
          <Image
            src="/resto-plus-logo.jpeg"
            alt="Resto+"
            width={54}
            height={54}
            priority
            className="rp-logo size-12 rounded-xl bg-white object-contain p-0.5"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-amber-400 uppercase">
              Gestion restaurant
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-white">
              Espace de démonstration
            </p>
          </div>
        </div>
        <div className="rp-nav-caption hidden px-5 pt-2 pb-3 text-[10px] font-bold tracking-[0.18em] text-slate-500 uppercase lg:block">
          Espace opérationnel
        </div>
        <nav
          aria-label="Navigation principale"
          className="rp-nav flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:px-3 lg:pb-4"
        >
          {navigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`rp-nav-link flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors lg:w-full lg:px-3.5 lg:py-3 ${item.active ? "is-active bg-amber-400 font-semibold text-slate-950" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
            >
              <Icon name={item.icon} className="size-[18px] shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
              {item.count && (
                <span
                  className={`rp-nav-count ml-auto hidden rounded-md px-1.5 py-0.5 text-[10px] lg:inline ${item.active ? "bg-black/10 text-slate-900" : "bg-white/10 text-slate-300"}`}
                >
                  {item.count}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="rp-user-card hidden border-t border-white/10 p-4 lg:block">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-amber-400/15 text-sm font-bold text-amber-300">
              JD
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">
                Jean Démonstration
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Gérant · Exemple fictif
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="rp-main min-w-0 flex-1 px-4 pt-5 pb-8 sm:px-6 lg:px-8 lg:py-7 xl:px-10">
        <header className="rp-header mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Lundi 19 octobre 2026{" "}
              <span className="mx-1.5 text-slate-300">·</span> Kinshasa, RDC
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">
              Tableau de bord
            </h1>
          </div>
          <div className="rp-header-actions flex items-center gap-2 sm:gap-3">
            <label className="hidden h-10 w-48 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 md:flex">
              <Icon name="search" className="size-4" />
              <span className="text-xs">Rechercher…</span>
              <span className="ml-auto text-[10px]">Ctrl K</span>
            </label>
            <button
              type="button"
              aria-label="Notifications de démonstration"
              className="relative flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
            >
              <Icon name="bell" className="size-[18px]" />
              <span className="absolute top-2 right-2 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>
            <div className="rp-restaurant-chip hidden items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-1.5 sm:flex">
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-800">
                R
              </span>
              <span className="text-xs font-semibold">Restaurant démo</span>
            </div>
          </div>
        </header>

        <div
          role="note"
          className="rp-demo-banner mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950"
        >
          <span>
            <strong>Données de démonstration.</strong> Les chiffres et états
            ci-dessous sont fictifs et ne proviennent pas d’un restaurant réel.
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-800 uppercase">
            Aperçu interface
          </span>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Activité du jour
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Chiffres affichés séparément par devise · 19/10/2026
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
          >
            Aujourd’hui <span className="text-slate-400">⌄</span>
          </button>
        </div>

        <section
          aria-label="Indicateurs de démonstration"
          className="rp-metrics grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <MetricCard
            label="Ventes encaissées · CDF"
            value="524 000 FC"
            sub="Franc congolais (CDF)"
            icon="cash"
            color="bg-amber-50 text-amber-700"
          />
          <MetricCard
            label="Ventes encaissées · USD"
            value="$ 186,00"
            sub="Dollar américain (USD)"
            icon="cash"
            color="bg-emerald-50 text-emerald-700"
          />
          <MetricCard
            label="Commandes en cours"
            value="7"
            sub="3 à suivre en priorité"
            icon="order"
            color="bg-blue-50 text-blue-700"
          />
          <MetricCard
            label="Tables occupées"
            value="6 / 18"
            sub="12 tables libres"
            icon="table"
            color="bg-violet-50 text-violet-700"
          />
        </section>

        <section
          className="rp-shortcuts-section mt-7"
          aria-labelledby="shortcuts-title"
        >
          <SectionHeading
            title="Accès rapides"
            detail="Raccourcis vers les espaces de gestion"
          />
          <div className="rp-shortcuts grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {shortcuts.map((shortcut) => (
              <Link
                key={shortcut.label}
                href={shortcut.href}
                className="rp-shortcut group flex min-h-[104px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm shadow-slate-900/[0.02] transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md sm:p-4"
              >
                <span
                  className={`rp-shortcut-icon flex size-10 shrink-0 items-center justify-center rounded-xl ${shortcut.color}`}
                >
                  <Icon name={shortcut.icon} className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="rp-shortcut-title block text-xs leading-5 font-bold text-slate-800 group-hover:text-amber-800">
                    {shortcut.label}
                  </span>
                  <span className="rp-shortcut-detail mt-0.5 block text-[10px] leading-4 text-slate-500">
                    {shortcut.detail}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="rp-primary-grid mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)]">
          <section
            className="rp-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.02] sm:p-5"
            aria-label="Commandes en cours de démonstration"
          >
            <SectionHeading
              title="Commandes en cours"
              detail="Suivi opérationnel · données fictives"
              href="/commandes"
              linkLabel="Voir les commandes"
            />
            <div className="divide-y divide-slate-100">
              {demoOrders.map((order) => (
                <div
                  key={order.number}
                  className="rp-order-row flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                      <Icon name="order" className="size-[17px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800">
                        {order.number}{" "}
                        <span className="font-normal text-slate-400">·</span>{" "}
                        {order.table}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {order.items}
                      </p>
                    </div>
                  </div>
                  <div className="rp-order-meta ml-auto flex items-center gap-2.5">
                    <span
                      className={`rp-order-status rounded-full px-2.5 py-1 text-[10px] font-semibold ${order.tone} ${order.status === "Nouvelle" ? "is-new" : "is-preparing"}`}
                    >
                      {order.status}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Icon name="clock" className="size-3" />
                      {order.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            className="rp-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.02] sm:p-5"
            aria-label="État de la cuisine et du bar de démonstration"
          >
            <SectionHeading
              title="Cuisine / Bar"
              detail="État des préparations · démo"
              href="/cuisine"
              linkLabel="Ouvrir"
            />
            <div className="rp-kitchen-list space-y-4">
              {demoKitchen.map((item) => (
                <div
                  key={item.label}
                  className="rp-kitchen-row flex items-center gap-3"
                >
                  <span className={`size-2.5 rounded-full ${item.color}`} />
                  <span className="flex-1 text-xs text-slate-600">
                    {item.label}
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
              Le suivi réel et l’envoi en cuisine ne sont pas encore connectés.
            </div>
          </section>
        </div>

        <div className="rp-secondary-grid mt-5 grid gap-5 xl:grid-cols-2">
          <section
            className="rp-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.02] sm:p-5"
            aria-label="Occupation des tables en démonstration"
          >
            <SectionHeading
              title="Occupation des tables"
              detail="Salle principale · vue fictive"
              href="/tables"
              linkLabel="Voir le plan"
            />
            <div className="rp-table-legend flex flex-wrap items-center gap-x-5 gap-y-2 pb-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-emerald-500" />
                Libre · 12
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-rose-500" />
                Occupée · 6
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-amber-400" />
                Addition demandée · 2
              </span>
            </div>
            <div className="rp-table-grid grid grid-cols-3 gap-2 sm:grid-cols-6">
              {["T01", "T02", "T03", "T04", "T05", "T06"].map(
                (table, index) => {
                  const state =
                    index === 1 || index === 4
                      ? "occupée"
                      : index === 2
                        ? "addition demandée"
                        : "libre";
                  const tone =
                    state === "occupée"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : state === "addition demandée"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700";
                  return (
                    <div
                      key={table}
                      className={`rp-table-chip rounded-xl border px-2 py-3 text-center ${tone} ${state === "occupée" ? "is-occupied" : state === "addition demandée" ? "is-checkout" : "is-free"}`}
                    >
                      <p className="text-xs font-bold">{table}</p>
                      <p className="mt-1 text-[9px]">{state}</p>
                    </div>
                  );
                },
              )}
            </div>
          </section>

          <section
            className="rp-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.02] sm:p-5"
            aria-label="Alertes de stock de démonstration"
          >
            <SectionHeading
              title="Alertes de stock"
              detail="Exemples fictifs · aucun inventaire connecté"
              href="/stocks"
              linkLabel="Voir le stock"
            />
            <div className="space-y-2.5">
              {[
                {
                  name: "Tomate",
                  amount: "3 kg restants",
                  status: "Sous le seuil",
                  tone: "bg-rose-50 text-rose-700",
                },
                {
                  name: "Huile végétale",
                  amount: "2 L restants",
                  status: "À surveiller",
                  tone: "bg-amber-50 text-amber-800",
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className="rp-stock-item flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      {item.name}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {item.amount}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.tone}`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="rp-footer mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-400">
          <span>Resto+ · Interface de démonstration · RDC</span>
          <span>FC / CDF et USD présentés séparément</span>
        </footer>
      </main>
    </div>
  );
}
