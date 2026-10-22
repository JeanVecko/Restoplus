import type { ReactNode } from "react";
import { Icon } from "./dashboard-icon";

export function SectionHeading({
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
          <p className="rp-section-detail mt-1 text-xs text-slate-500">{detail}</p>
        )}
      </div>
      {href && (
        <a
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
          href={href}
        >
          {linkLabel ?? "Tout voir"}
          <Icon name="arrow" className="size-3.5" />
        </a>
      )}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  color: string;
}) {
  return (
    <article className="rp-metric-card rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.02] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="rp-metric-label text-xs font-medium text-slate-500">{label}</p>
          <p className="rp-metric-value mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {value}
          </p>
          <p className="rp-metric-sub mt-1.5 text-[11px] text-slate-500">{sub}</p>
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

export function DashboardMetrics({
  totals,
  waiting,
  inPreparation,
  ready,
  occupied,
  total,
  activeProducts,
  inactiveProducts,
}: {
  totals: Record<string, number>;
  waiting: number;
  inPreparation: number;
  ready: number;
  occupied: number;
  total: number;
  activeProducts: number;
  inactiveProducts: number;
}) {
  const format = (amount: number, currency: string) =>
    new Intl.NumberFormat("fr-CD", {
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    }).format(amount);

  return (
    <section
      aria-label="Indicateurs"
      className="rp-metrics grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <MetricCard
        label="Ventes du jour · CDF"
        value={`${format(totals.CDF ?? 0, "CDF")} FC`}
        sub="Franc congolais (CDF)"
        icon="cash"
        color="bg-amber-50 text-amber-700"
      />
      <MetricCard
        label="Ventes du jour · USD"
        value={`$ ${format(totals.USD ?? 0, "USD")}`}
        sub="Dollar américain (USD)"
        icon="cash"
        color="bg-emerald-50 text-emerald-700"
      />
      <MetricCard
        label="Commandes en cours"
        value={`${waiting + inPreparation + ready}`}
        sub={`${waiting} à valider · ${inPreparation} en préparation · ${ready} prêtes`}
        icon="order"
        color="bg-blue-50 text-blue-700"
      />
      <MetricCard
        label="Tables occupées"
        value={`${occupied} / ${total}`}
        sub={`${Math.max(total - occupied, 0)} tables libres · ${activeProducts} produits actifs · ${inactiveProducts} inactifs`}
        icon="table"
        color="bg-violet-50 text-violet-700"
      />
    </section>
  );
}