"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Product as CatalogProduct } from "@/features/menu/types";
import {
  formatDemoPrice,
  type DemoOrder,
  type OrderLine,
  type OrderStation,
  type TicketStatus,
} from "../types";
import { useOrdersWorkflow } from "../use-orders-workflow";
import styles from "./order-workspace.module.css";

type WorkspaceMode = "service" | "cashier" | "kitchen";

const tabs: { label: string; href: string; mode: WorkspaceMode }[] = [
  { label: "Service", href: "/commandes", mode: "service" },
  { label: "Validation caisse", href: "/caisse", mode: "cashier" },
  { label: "Cuisine / Bar", href: "/cuisine", mode: "kitchen" },
];

function stationName(station: OrderStation) {
  return station === "CUISINE" ? "Cuisine" : "Bar";
}

function statusName(status: DemoOrder["status"] | TicketStatus) {
  if (status === "WAITING_CASHIER") return "À valider par la caisse";
  if (status === "IN_PREPARATION") return "En préparation";
  if (status === "READY") return "Prête";
  if (status === "PENDING") return "Nouveau bon";
  return status;
}

function orderTotals(lines: OrderLine[]) {
  return lines.reduce(
    (totals, line) => {
      totals[line.currency] += line.amount * line.quantity;
      return totals;
    },
    { CDF: 0, USD: 0 },
  );
}

function OrderSummary({ order }: { order: DemoOrder }) {
  const totals = orderTotals(order.lines);
  return (
    <div className={styles.orderSummary}>
      <span>
        {order.lines.reduce((count, line) => count + line.quantity, 0)}{" "}
        article(s)
      </span>
      <span>{totals.CDF > 0 ? formatDemoPrice(totals.CDF, "CDF") : null}</span>
      <span>{totals.USD > 0 ? formatDemoPrice(totals.USD, "USD") : null}</span>
    </div>
  );
}

function OrderCard({
  children,
  order,
}: {
  children?: ReactNode;
  order: DemoOrder;
}) {
  return (
    <article className={styles.orderCard}>
      <div className={styles.orderCardHeading}>
        <div>
          <span className={styles.orderNumber}>{order.number}</span>
          <span className={styles.tableName}>{order.table}</span>
        </div>
        <span
          className={`${styles.status} ${styles[`status_${order.status}`]}`}
        >
          {statusName(order.status)}
        </span>
      </div>
      <p className={styles.orderMeta}>Créée par {order.createdBy}</p>
      <ul className={styles.lineList}>
        {order.lines.map((line, index) => (
          <li key={`${line.id}-${index}`}>
            <span>
              {line.quantity} × {line.name}
            </span>
            <small>{stationName(line.station)}</small>
          </li>
        ))}
      </ul>
      <OrderSummary order={order} />
      {children}
    </article>
  );
}

export default function OrderWorkspace({ mode }: { mode: WorkspaceMode }) {
  const workflow = useOrdersWorkflow();
  const [table, setTable] = useState("Table 01");
  const [basket, setBasket] = useState<OrderLine[]>([]);
  const [feedback, setFeedback] = useState("");
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [ticketToPrint, setTicketToPrint] = useState<{
    number: string;
    station: OrderStation;
    table: string;
    orderNumber: string;
    items: OrderLine[];
    issuedAt: string;
  } | null>(null);

  // Chargement du catalogue persistant depuis /api/menu
  useEffect(() => {
    let active = true;
    fetch("/api/menu", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error ?? "Catalogue persistant inaccessible.");
        }
        if (active && Array.isArray(data.products)) {
          setCatalog(data.products as CatalogProduct[]);
        }
      })
      .catch((err) => {
        if (active) {
          setCatalogError(
            err instanceof Error
              ? err.message
              : "Erreur de chargement du catalogue.",
          );
        }
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const availableTables = useMemo(() => {
    const list = workflow.tables.map((t) => t.tableNumber);
    if (!list.includes("À emporter")) {
      list.push("À emporter");
    }
    return list.length > 0
      ? list
      : ["Table 01", "Table 02", "Table 03", "À emporter"];
  }, [workflow.tables]);

  const currentTable = availableTables.includes(table)
    ? table
    : (availableTables[0] ?? "Table 01");

  const waiting = useMemo(
    () => workflow.orders.filter((order) => order.status === "WAITING_CASHIER"),
    [workflow.orders],
  );
  const active = useMemo(
    () => workflow.orders.filter((order) => order.status === "IN_PREPARATION"),
    [workflow.orders],
  );
  const ready = useMemo(
    () => workflow.orders.filter((order) => order.status === "READY"),
    [workflow.orders],
  );

  function addProduct(product: CatalogProduct) {
    setBasket((current) => {
      const existing = current.find((line) => line.id === product.id);
      return existing
        ? current.map((line) =>
            line.id === product.id
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          )
        : [
            ...current,
            {
              id: product.id,
              name: product.name,
              station: product.preparationStation,
              amount: Number(product.price.amount),
              currency: product.price.currency,
              quantity: 1,
            },
          ];
    });
  }

  function decreaseProduct(productId: string) {
    setBasket((current) =>
      current
        .map((line) =>
          line.id === productId
            ? { ...line, quantity: line.quantity - 1 }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  async function submitOrder() {
    if (!basket.length) return;
    try {
      await workflow.submitOrder(currentTable, basket);
      setBasket([]);
      setFeedback(
        "Commande enregistrée sur le serveur et transmise à la caisse.",
      );
    } catch {
      // Les erreurs de persistance sont reflétées dans workflow.error
    }
  }

  function printTicket(ticket: {
    number: string;
    station: OrderStation;
    table: string;
    orderNumber: string;
    items: OrderLine[];
    issuedAt: string;
  }) {
    setTicketToPrint(ticket);
    window.requestAnimationFrame(() => window.print());
  }

  const pageTitle =
    mode === "service"
      ? "Prise de commande"
      : mode === "cashier"
        ? "Validation des bons"
        : "Cuisine / Bar";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/">
            ← Tableau de bord
          </Link>
          <p className={styles.kicker}>Resto+ · Circuit des commandes</p>
          <h1>{pageTitle}</h1>
          <p className={styles.subtitle}>
            Du service à la préparation, avec validation préalable de la caisse.
          </p>
        </div>
        <button
          className={styles.resetButton}
          type="button"
          onClick={() => workflow.refresh()}
          disabled={workflow.refreshing}
        >
          {workflow.refreshing ? "Actualisation…" : "↻ Actualiser"}
        </button>
      </header>

      <nav
        className={styles.tabs}
        aria-label="Étapes du circuit"
        role="tablist"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.mode}
            href={tab.href}
            className={`${styles.tab} ${mode === tab.mode ? styles.tabActive : ""}`}
            aria-current={mode === tab.mode ? "page" : undefined}
          >
            {tab.label}
            <span>
              {tab.mode === "service"
                ? null
                : tab.mode === "cashier"
                  ? waiting.length
                  : active.length}
            </span>
          </Link>
        ))}
      </nav>

      {feedback && (
        <p className={styles.feedback} role="status">
          {feedback}
        </p>
      )}
      {workflow.error && (
        <p className={styles.feedback} role="alert">
          {workflow.error}
        </p>
      )}
      {!workflow.loaded && (
        <p className={styles.loading}>Chargement des données…</p>
      )}

      {mode === "service" && (
        <div className={styles.twoColumn}>
          <section className={styles.panel} aria-labelledby="catalog-title">
            <div className={styles.panelHeading}>
              <div>
                <p className={styles.eyebrow}>Serveur · Prise de commande</p>
                <h2 id="catalog-title">Composer une commande</h2>
              </div>
              <label className={styles.tableSelect}>
                Table
                <select
                  value={currentTable}
                  onChange={(event) => setTable(event.target.value)}
                >
                  {availableTables.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className={styles.helper}>
              Articles disponibles sur la carte du restaurant. Les montants
              restent séparés par devise.
            </p>
            {catalogLoading && (
              <p className={styles.loading}>Chargement de la carte…</p>
            )}
            {catalogError && (
              <p className={styles.feedback} role="alert">
                {catalogError}
              </p>
            )}
            {!catalogLoading &&
              !catalogError &&
              catalog.filter((p) => p.available).length === 0 && (
                <p className={styles.helper}>
                  Aucun article disponible sur la carte actuellement.
                </p>
              )}
            <div className={styles.productGrid}>
              {catalog
                .filter((product) => product.available)
                .map((product) => (
                  <button
                    className={styles.productButton}
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                  >
                    <span className={styles.productMark}>
                      {product.preparationStation === "CUISINE" ? "C" : "B"}
                    </span>
                    <span className={styles.productCopy}>
                      <strong>{product.name}</strong>
                      <small>
                        {stationName(product.preparationStation)} ·{" "}
                        {formatDemoPrice(
                          Number(product.price.amount),
                          product.price.currency,
                        )}
                      </small>
                    </span>
                    <span className={styles.addSign}>+</span>
                  </button>
                ))}
            </div>
          </section>

          <section
            className={`${styles.panel} ${styles.basketPanel}`}
            aria-labelledby="basket-title"
          >
            <div className={styles.panelHeading}>
              <div>
                <p className={styles.eyebrow}>Étape 1 sur 3</p>
                <h2 id="basket-title">Commande · {currentTable}</h2>
              </div>
              <span className={styles.countPill}>
                {basket.reduce((total, line) => total + line.quantity, 0)}{" "}
                article(s)
              </span>
            </div>
            {basket.length ? (
              <ul className={styles.basketList}>
                {basket.map((line) => (
                  <li key={line.id}>
                    <div>
                      <strong>{line.name}</strong>
                      <small>
                        {stationName(line.station)} ·{" "}
                        {formatDemoPrice(line.amount, line.currency)}
                      </small>
                    </div>
                    <div className={styles.quantityControl}>
                      <button
                        type="button"
                        onClick={() => decreaseProduct(line.id)}
                        aria-label={`Retirer un ${line.name}`}
                      >
                        −
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const item = catalog.find((p) => p.id === line.id);
                          if (item) addProduct(item);
                        }}
                        aria-label={`Ajouter un ${line.name}`}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.emptyBasket}>
                <span>＋</span>
                <p>Ajoutez des articles pour commencer.</p>
              </div>
            )}
            <div className={styles.basketFooter}>
              <p>
                La caisse doit valider la commande avant qu’un bon ne soit émis.
              </p>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={!basket.length}
                onClick={submitOrder}
              >
                Transmettre à la caisse <span>→</span>
              </button>
            </div>
          </section>
          <section
            className={`${styles.panel} ${styles.fullWidth}`}
            aria-labelledby="recent-title"
          >
            <div className={styles.panelHeading}>
              <div>
                <p className={styles.eyebrow}>Suivi serveur</p>
                <h2 id="recent-title">Commandes récentes</h2>
              </div>
              <span className={styles.countPill}>{workflow.orders.length}</span>
            </div>
            <div className={styles.compactOrderGrid}>
              {workflow.orders.slice(0, 4).map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          </section>
        </div>
      )}

      {mode === "cashier" && (
        <section className={styles.panel} aria-labelledby="cashier-title">
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Étape obligatoire avant émission</p>
              <h2 id="cashier-title">À vérifier par la caisse</h2>
              <p className={styles.helper}>
                Contrôlez la table et les quantités, puis validez pour émettre
                les bons Cuisine et/ou Bar.
              </p>
            </div>
            <span className={styles.countPill}>
              {waiting.length} en attente
            </span>
          </div>
          {waiting.length ? (
            <div className={styles.orderGrid}>
              {waiting.map((order) => (
                <OrderCard key={order.id} order={order}>
                  <button
                    className={styles.primaryButton}
                    type="button"
                    onClick={() => workflow.validateAtCashier(order.id)}
                  >
                    Valider et émettre les bons <span>→</span>
                  </button>
                </OrderCard>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>Aucune commande à valider</strong>
              <span>
                Les nouvelles commandes envoyées par le service apparaîtront
                ici.
              </span>
              <Link href="/commandes">Créer une commande</Link>
            </div>
          )}
          <div className={styles.sectionDivider}>
            <h3>Bons déjà émis</h3>
            <span>{active.length + ready.length} commande(s)</span>
          </div>
          <div className={styles.orderGrid}>
            {workflow.orders
              .filter((order) => order.tickets.length > 0)
              .map((order) => (
                <OrderCard key={order.id} order={order}>
                  <div className={styles.ticketReferences}>
                    {order.tickets.map((ticket) => (
                      <span key={ticket.id}>
                        {ticket.number} · {stationName(ticket.station)} ·{" "}
                        {statusName(ticket.status)}
                      </span>
                    ))}
                  </div>
                </OrderCard>
              ))}
          </div>
        </section>
      )}

      {mode === "kitchen" && (
        <section className={styles.panel} aria-labelledby="kitchen-title">
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Étape après validation caisse</p>
              <h2 id="kitchen-title">Bons transmis aux postes</h2>
              <p className={styles.helper}>
                Un bon n’est visible qu’après validation de la caisse. Chaque
                poste fait avancer son propre ticket.
              </p>
            </div>
            <span className={styles.countPill}>{active.length} en cours</span>
          </div>
          <div className={styles.stationGrid}>
            {(["CUISINE", "BAR"] as const).map((station) => {
              const tickets = workflow.orders.flatMap((order) =>
                order.tickets
                  .filter((ticket) => ticket.station === station)
                  .map((ticket) => ({ order, ticket })),
              );
              return (
                <section
                  className={styles.stationPanel}
                  key={station}
                  aria-label={`Poste ${stationName(station)}`}
                >
                  <div className={styles.stationHeading}>
                    <span className={styles.stationIcon}>
                      {station === "CUISINE" ? "C" : "B"}
                    </span>
                    <div>
                      <h3>{stationName(station)}</h3>
                      <span>
                        {
                          tickets.filter(
                            ({ ticket }) => ticket.status !== "READY",
                          ).length
                        }{" "}
                        bon(s) à traiter
                      </span>
                    </div>
                  </div>
                  {tickets.length ? (
                    <div className={styles.ticketList}>
                      {tickets.map(({ order, ticket }) => (
                        <article className={styles.ticketCard} key={ticket.id}>
                          <div className={styles.ticketHeader}>
                            <strong>{ticket.number}</strong>
                            <span>{order.table}</span>
                          </div>
                          <span
                            className={`${styles.status} ${ticket.status === "READY" ? styles.status_READY : ticket.status === "PENDING" ? styles.status_WAITING_CASHIER : styles.status_IN_PREPARATION}`}
                          >
                            {statusName(ticket.status)}
                          </span>
                          <ul className={styles.ticketItems}>
                            {ticket.items.map((item, index) => (
                              <li key={`${item.id}-${index}`}>
                                <strong>{item.quantity} ×</strong> {item.name}
                              </li>
                            ))}
                          </ul>
                          <div className={styles.ticketActions}>
                            {ticket.status !== "READY" && (
                              <button
                                className={styles.primaryButton}
                                type="button"
                                onClick={() =>
                                  workflow.updateTicket(
                                    order.id,
                                    ticket.id,
                                    ticket.status === "PENDING"
                                      ? "IN_PREPARATION"
                                      : "READY",
                                  )
                                }
                              >
                                {ticket.status === "PENDING"
                                  ? "Commencer la préparation"
                                  : "Marquer prête"}
                              </button>
                            )}
                            <button
                              className={styles.secondaryButton}
                              type="button"
                              onClick={() =>
                                printTicket({
                                  number: ticket.number,
                                  station: ticket.station,
                                  table: order.table,
                                  orderNumber: order.number,
                                  items: ticket.items,
                                  issuedAt: ticket.issuedAt,
                                })
                              }
                            >
                              Aperçu / imprimer
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <strong>Aucun bon émis</strong>
                      <span>
                        Les bons apparaîtront après contrôle et validation par
                        la caisse.
                      </span>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <div className={styles.sectionDivider}>
            <h3>Commandes prêtes</h3>
            <span>{ready.length}</span>
          </div>
          {ready.length ? (
            renderReadyOrders(ready)
          ) : (
            <div className={styles.emptyReady}>
              Les commandes passeront ici lorsque tous leurs bons seront marqués
              « Prête ».
            </div>
          )}
        </section>
      )}

      {ticketToPrint && (
        <div className={styles.printOnly}>
          <div className={styles.printTicket}>
            <p>RESTO+ · {stationName(ticketToPrint.station).toUpperCase()}</p>
            <h1>{ticketToPrint.number}</h1>
            <p>
              {ticketToPrint.orderNumber} · {ticketToPrint.table}
            </p>
            <hr />
            {ticketToPrint.items.map((item, index) => (
              <p key={`${item.id}-${index}`}>
                <strong>{item.quantity} ×</strong> {item.name}
              </p>
            ))}
            <hr />
            <small>
              Bon de préparation ·{" "}
              {new Date(ticketToPrint.issuedAt).toLocaleString("fr-CD")}
            </small>
          </div>
        </div>
      )}
    </main>
  );
}

function renderReadyOrders(orders: DemoOrder[]) {
  return (
    <div className={styles.orderGrid}>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order}>
          <span className={styles.readyMark}>✓ Tous les bons sont prêts</span>
        </OrderCard>
      ))}
    </div>
  );
}
