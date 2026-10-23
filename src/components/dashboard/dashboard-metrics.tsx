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
    <div className="rp-section-heading mb-5 flex items-end justify-between gap-3">
      <div>
        <h2 className="rp-section-title text-lg font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        {detail && (
          <p className="rp-section-detail mt-1 text-xs text-slate-500">{detail}</p>
        )}
      </div>
      {href && (
        <a
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
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
  gradient,
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  color: string;
  gradient?: string;
}) {
  return (
    <article className="rp-metric-card group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm shadow-slate-900/[0.03] transition-all duration-300 hover:shadow-lg hover:shadow-slate-900/[0.06] hover:-translate-y-0.5 sm:p-6">
      <div className={`absolute -right-6 -top-6 size-24 rounded-full opacity-[0.07] ${gradient ?? "bg-slate-400"}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="rp-metric-label text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="rp-metric-value mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {value}
          </p>
          <p className="rp-metric-sub mt-2 text-xs text-slate-500">{sub}</p>
        </div>
        <span
          className={`rp-metric-icon flex size-12 shrink-0 items-center justify-center rounded-2xl ${color} shadow-sm`}
        >
          <Icon name={icon} className="size-6" />
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
      className="rp-metrics grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <MetricCard
        label="Ventes du jour · CDF"
        value={`${format(totals.CDF ?? 0, "CDF")} FC`}
        sub="Franc congolais (CDF)"
        icon="cash"
        color="bg-amber-50 text-amber-600"
        gradient="bg-amber-400"
      />
      <MetricCard
        label="Ventes du jour · USD"
        value={`$ ${format(totals.USD ?? 0, "USD")}`}
        sub="Dollar américain (USD)"
        icon="cash"
        color="bg-emerald-50 text-emerald-600"
        gradient="bg-emerald-400"
      />
      <MetricCard
        label="Commandes en cours"
        value={`${waiting + inPreparation + ready}`}
        sub={`${waiting} à valider · ${inPreparation} en préparation · ${ready} prêtes`}
        icon="order"
        color="bg-blue-50 text-blue-600"
        gradient="bg-blue-400"
      />
      <MetricCard
        label="Tables occupées"
        value={`${occupied} / ${total}`}
        sub={`${Math.max(total - occupied, 0)} tables libres · ${activeProducts} produits actifs`}
        icon="table"
        color="bg-violet-50 text-violet-600"
        gradient="bg-violet-400"
      />
    </section>
  );
}
