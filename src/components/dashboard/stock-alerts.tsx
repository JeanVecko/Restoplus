import { Icon } from "./dashboard-icon";

export function StockAlerts({
  items,
  href,
  linkLabel,
}: {
  items: Array<{
    name: string;
    amount: string;
    status: string;
    tone: string;
  }>;
  href: string;
  linkLabel: string;
}) {
  return (
    <section
      className="rp-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.02] sm:p-5"
      aria-label="Alertes de stock"
    >
      <div className="rp-section-heading mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="rp-section-title text-base font-bold tracking-tight text-slate-900">
            Alertes de stock
          </h2>
          <p className="rp-section-detail mt-1 text-xs text-slate-500">
            Articles indisponibles
          </p>
        </div>
        <a
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
          href={href}
        >
          {linkLabel}
          <Icon name="arrow" className="size-3.5" />
        </a>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
          Aucune alerte. Tous les produits sont disponibles.
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.name}
              className="rp-stock-item flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-3"
            >
              <div>
                <p className="text-xs font-semibold text-slate-800">{item.name}</p>
                <p className="mt-1 text-[10px] text-slate-500">{item.amount}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.tone}`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
