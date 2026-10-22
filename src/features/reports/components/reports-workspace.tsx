"use client";

import { useMemo } from "react";
import type { AuthenticatedActor } from "@/server/auth/session";
import type { OrderRecord } from "@/server/orders/service";
import type { DiningTable } from "@/server/tables/service";
import type { StockItem } from "@/server/stocks/service";
import styles from "./reports-workspace.module.css";

type CatalogProduct = {
  id: string;
  active: boolean;
  available: boolean;
};

type Catalog = {
  categories: Array<{ id: string }>;
  products: CatalogProduct[];
};

type Props = {
  actor: AuthenticatedActor;
  orders: OrderRecord[];
  tables: DiningTable[];
  catalog: Catalog;
  stocks: StockItem[];
};

export function ReportsWorkspace({ actor, orders, tables, catalog, stocks }: Props) {
  const today = new Date();
  const todayStr = today.toDateString();

  const todayOrders = useMemo(
    () => orders.filter(
      (order) =>
        order.createdAt instanceof Date &&
        order.createdAt.toDateString() === todayStr,
    ),
    [orders, todayStr],
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

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const order of orders) {
      map[order.status] = (map[order.status] ?? 0) + 1;
    }
    return map;
  }, [orders]);

  const byCurrency = useMemo(() => {
    const map: Record<string, number> = { CDF: 0, USD: 0 };
    for (const order of orders) {
      for (const line of order.lines ?? []) {
        map[line.currency] =
          (map[line.currency] ?? 0) + line.quantity * Number(line.unitPriceAmount);
      }
    }
    return map;
  }, [orders]);

  const cancelled = byStatus.CANCELLED ?? 0;
  const completed = byStatus.COMPLETED ?? 0;

  const lowStock = useMemo(
    () =>
      stocks.filter(
        (item) => item.isActive && item.threshold > 0 && item.quantity <= item.threshold,
      ),
    [stocks],
  );

  const format = (amount: number, currency: string) =>
    new Intl.NumberFormat("fr-CD", {
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    }).format(amount);

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Synthèse</p>
          <h1>Rapports</h1>
          <p className={styles.subtitle}>
            Données persistantes pour le restaurant {actor.restaurantName}.
          </p>
        </div>
      </header>

      <section className={styles.metrics}>
        <article className={styles.card}>
          <p className={styles.label}>Commandes aujourd&apos;hui</p>
          <p className={styles.value}>{todayOrders.length}</p>
          <p className={styles.sub}>Total commandes : {orders.length}</p>
        </article>
        <article className={styles.card}>
          <p className={styles.label}>Ventes CDF</p>
          <p className={styles.value}>{format(byCurrency.CDF, "CDF")} FC</p>
          <p className={styles.sub}>aujourd&apos;hui : {format(totals.CDF, "CDF")} FC</p>
        </article>
        <article className={styles.card}>
          <p className={styles.label}>Ventes USD</p>
          <p className={styles.value}>$ {format(byCurrency.USD, "USD")}</p>
          <p className={styles.sub}>aujourd&apos;hui : $ {format(totals.USD, "USD")}</p>
        </article>
        <article className={styles.card}>
          <p className={styles.label}>Commandes terminées</p>
          <p className={styles.value}>{completed}</p>
          <p className={styles.sub}>Annulées : {cancelled}</p>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <h2>Commandes par statut</h2>
          <ul className={styles.list}>
            {Object.entries(byStatus).map(([status, count]) => (
              <li key={status} className={styles.row}>
                <span>{status}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className={styles.panel}>
          <h2>Tables</h2>
          <ul className={styles.list}>
            <li className={styles.row}>
              <span>Tables enregistrées</span>
              <strong>{tables.length}</strong>
            </li>
            <li className={styles.row}>
              <span>Actives</span>
              <strong>{tables.filter((t) => t.isActive).length}</strong>
            </li>
          </ul>
        </article>

        <article className={styles.panel}>
          <h2>Catalogue</h2>
          <ul className={styles.list}>
            <li className={styles.row}>
              <span>Produits actifs</span>
              <strong>{catalog.products.filter((p) => p.active && p.available).length}</strong>
            </li>
            <li className={styles.row}>
              <span>Catégories</span>
              <strong>{catalog.categories.length}</strong>
            </li>
          </ul>
        </article>

        <article className={styles.panel}>
          <h2>Alertes stock</h2>
          {lowStock.length === 0 ? (
            <p className={styles.empty}>Aucune alerte.</p>
          ) : (
            <ul className={styles.list}>
              {lowStock.map((item) => (
                <li key={item.id} className={styles.row}>
                  <span>
                    {item.name} ({item.quantity} {item.unit})
                  </span>
                  <strong>Seuil {item.threshold}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <footer className={styles.footer}>
        <span>Resto+ · Rapports · Données persistantes</span>
        <span>FC / CDF et USD presentes separatement</span>
      </footer>
    </div>
  );
}