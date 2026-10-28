"use client";

import { useMemo } from "react";
import type { AuthenticatedActor, DiningTable, OrderRecord } from "@/lib/demo-types";
import { DashboardLayout } from "./dashboard-layout";
import { DashboardMetrics } from "./dashboard-metrics";
import { OrderList } from "./order-list";
import { TableGrid } from "./table-grid";
import { StockAlerts } from "./stock-alerts";

type CatalogProduct = {
  id: string;
  name: string;
  active: boolean;
  available: boolean;
};

type Catalog = {
  categories: Array<{ id: string }>;
  products: CatalogProduct[];
};

export function DashboardClient({
  actor,
  orders,
  tables,
  catalog,
}: {
  actor: AuthenticatedActor;
  orders: OrderRecord[];
  tables: DiningTable[];
  catalog: Catalog;
}) {
  const today = useMemo(() => new Date(), []);
  const todayStr = today.toLocaleDateString("fr-CD", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const todayOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.createdAt instanceof Date &&
          order.createdAt.toDateString() === today.toDateString(),
      ),
    [orders, today],
  );

  const totals = useMemo(() => {
    const result: Record<string, number> = { CDF: 0, USD: 0 };
    for (const order of todayOrders) {
      for (const line of order.lines ?? []) {
        result[line.currency] =
          (result[line.currency] ?? 0) + line.quantity * Number(line.unitPriceAmount);
      }
    }
    return result;
  }, [todayOrders]);

  const waiting = useMemo(
    () => orders.filter((order) => order.status === "WAITING_CASHIER"),
    [orders],
  );
  const inPreparation = useMemo(
    () => orders.filter((order) => order.status === "IN_PREPARATION"),
    [orders],
  );
  const ready = useMemo(
    () => orders.filter((order) => order.status === "READY"),
    [orders],
  );

  const occupiedTables = useMemo(
    () =>
      tables.filter((table) =>
        orders.some(
          (order) =>
            !order.isTakeaway &&
            order.tableName === table.tableNumber &&
            order.status !== "CANCELLED" &&
            order.status !== "COMPLETED",
        ),
      ),
    [orders, tables],
  );

  const lowStockItems = useMemo(
    () =>
      catalog.products
        .filter((product) => !product.available)
        .slice(0, 2)
        .map((product) => ({
          name: product.name,
          amount: "Indisponible",
          status: "Indisponible",
          tone: "bg-rose-50 text-rose-700",
        })),
    [catalog],
  );

  const activeProducts = catalog.products.filter((p) => p.active && p.available).length;
  const inactiveProducts = catalog.products.length - activeProducts;

  return (
    <DashboardLayout actor={actor} todayStr={todayStr}>
      <DashboardMetrics
        totals={totals}
        waiting={waiting.length}
        inPreparation={inPreparation.length}
        ready={ready.length}
        occupied={occupiedTables.length}
        total={tables.length}
        activeProducts={activeProducts}
        inactiveProducts={inactiveProducts}
      />

      <div className="rp-primary-grid mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <OrderList
          orders={orders}
          href="/commandes"
          linkLabel="Voir les commandes"
        />
        <StockAlerts items={lowStockItems} href="/stocks" linkLabel="Voir le stock" />
      </div>

      <div className="rp-secondary-grid mt-6 grid gap-6 xl:grid-cols-2">
        <TableGrid tables={tables} occupied={occupiedTables} href="/tables" />
      </div>
    </DashboardLayout>
  );
}
