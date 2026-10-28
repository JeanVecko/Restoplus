import type { OrderRecord } from "@/lib/demo-types";
import { SectionHeading } from "./dashboard-metrics";

function statusLabel(status: OrderRecord["status"]) {
  if (status === "WAITING_CASHIER") return "À valider";
  if (status === "IN_PREPARATION") return "En préparation";
  if (status === "READY") return "Prête";
  if (status === "COMPLETED") return "Terminée";
  if (status === "CANCELLED") return "Annulée";
  return status;
}

function statusTone(status: OrderRecord["status"]) {
  switch (status) {
    case "WAITING_CASHIER":
      return "bg-blue-100 text-blue-800";
    case "IN_PREPARATION":
      return "bg-amber-100 text-amber-800";
    case "READY":
      return "bg-emerald-100 text-emerald-800";
    case "COMPLETED":
      return "bg-slate-200 text-slate-700";
    case "CANCELLED":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatTime(date: Date | null) {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h`;
}

export function OrderList({
  orders,
  href,
  linkLabel,
}: {
  orders: OrderRecord[];
  href: string;
  linkLabel: string;
}) {
  const recent = orders.slice(0, 5);

  return (
    <section
      className="rp-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.02] sm:p-5"
      aria-label="Commandes récentes"
    >
      <SectionHeading
        title="Commandes récentes"
        detail="Données persistantes"
        href={href}
        linkLabel={linkLabel}
      />
      {recent.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
          Aucune commande enregistrée.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {recent.map((order) => (
            <div
              key={order.id}
              className="rp-order-row flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                  <span className="text-xs font-bold">{order.orderNumber.slice(-4)}</span>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800">
                    {order.orderNumber}{" "}
                    <span className="font-normal text-slate-400">·</span>{" "}
                    {order.isTakeaway ? "À emporter" : order.tableName}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {(order.lines ?? []).reduce(
                      (sum, line) => sum + line.quantity,
                      0,
                    )}{" "}
                    article(s) · {order.serverName}
                  </p>
                </div>
              </div>
              <div className="rp-order-meta ml-auto flex items-center gap-2.5">
                <span
                  className={`rp-order-status rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone(order.status)}`}
                >
                  {statusLabel(order.status)}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  {formatTime(order.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
