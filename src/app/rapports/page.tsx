import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/server/auth/session";
import { listOrdersService } from "@/server/orders/service";
import { listDiningTables } from "@/server/tables/service";
import { listMenuCatalog } from "@/server/catalog/service";
import { listStockItems } from "@/server/stocks/service";
import { ReportsWorkspace } from "@/features/reports/components/reports-workspace";

export const metadata: Metadata = {
  title: "Rapports — Resto+",
  description: "Synthèse de l'activité et indicateurs",
};

export default async function ReportsPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    redirect("/login");
  }

  const [orders, tables, catalog, stocks] = await Promise.all([
    listOrdersService(actor),
    listDiningTables(actor),
    listMenuCatalog(actor),
    listStockItems(actor),
  ]);

  return (
    <ReportsWorkspace
      actor={actor}
      orders={orders}
      tables={tables}
      catalog={catalog}
      stocks={stocks}
    />
  );
}