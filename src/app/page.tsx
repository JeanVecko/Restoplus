import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/server/auth/session";
import { listDiningTables } from "@/server/tables/service";
import { listOrdersService } from "@/server/orders/service";
import { listMenuCatalog } from "@/server/catalog/service";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata: Metadata = {
  title: "Tableau de bord - Resto+",
  description: "Vue d'ensemble des ventes, commandes, tables et alertes",
};

export default async function HomePage() {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    redirect("/login");
  }

  const [orders, tables, catalog] = await Promise.all([
    listOrdersService(actor),
    listDiningTables(actor),
    listMenuCatalog(actor),
  ]);

  return (
    <DashboardClient
      actor={actor}
      orders={orders}
      tables={tables}
      catalog={catalog}
    />
  );
}