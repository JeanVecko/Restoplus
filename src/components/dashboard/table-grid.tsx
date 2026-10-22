import type { DiningTable } from "@/server/tables/service";
import { SectionHeading } from "./dashboard-metrics";

function statusTone(table: DiningTable, occupied: DiningTable[]) {
  const isOccupied = occupied.some((t) => t.id === table.id);
  if (isOccupied) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function statusLabel(table: DiningTable, occupied: DiningTable[]) {
  if (occupied.some((t) => t.id === table.id)) return "Occupée";
  return "Libre";
}

export function TableGrid({
  tables,
  occupied,
  href,
}: {
  tables: DiningTable[];
  occupied: DiningTable[];
  href: string;
}) {
  const zoneLabel: Record<DiningTable["zone"], string> = {
    STANDARD: "S",
    TERRACE: "T",
    VIP: "V",
  };

  return (
    <section
      className="rp-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.02] sm:p-5"
      aria-label="Occupation des tables"
    >
      <SectionHeading
        title="Occupation des tables"
        detail="Salle principale"
        href={href}
        linkLabel="Voir le plan"
      />
      <div className="rp-table-legend flex flex-wrap items-center gap-x-5 gap-y-2 pb-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-emerald-500" /> Libre
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-rose-500" /> Occupée
        </span>
      </div>
      {tables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
          Aucune table enregistrée.
        </div>
      ) : (
        <div className="rp-table-grid grid grid-cols-3 gap-2 sm:grid-cols-6">
          {tables.map((table) => {
            const tone = statusTone(table, occupied);
            const label = statusLabel(table, occupied);
            return (
              <div
                key={table.id}
                className={`rp-table-chip rounded-xl border px-2 py-3 text-center ${tone}`}
              >
                <p className="text-xs font-bold">
                  {table.tableNumber}
                  <span className="ml-1 text-[9px] text-slate-400">
                    {zoneLabel[table.zone]}
                  </span>
                </p>
                <p className="mt-1 text-[9px]">{label}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}