"use client";

import { useCallback, useEffect, useState } from "react";
import type { DemoOrder, TicketStatus } from "./types";

export type DiningTableOption = {
  id: string;
  tableNumber: string;
  zone: string;
};

export function useOrdersWorkflow() {
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [tables, setTables] = useState<DiningTableOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Chargement des commandes et des tables depuis l'API serveur /api/orders
  const fetchServerOrders = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error ??
            (response.status === 401
              ? "Authentification requise pour accéder aux commandes."
              : "Impossible de charger les commandes depuis le serveur."),
        );
      }
      if (data && Array.isArray(data.orders)) {
        setOrders(data.orders as DemoOrder[]);
        if (Array.isArray(data.tables)) {
          setTables(data.tables as DiningTableOption[]);
        }
        setIsLive(true);
        setError(null);
        return true;
      }
      throw new Error("Format de réponse inattendu du serveur.");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erreur de connexion au serveur.";
      setError(msg);
      setIsLive(false);
      return false;
    } finally {
      setLoaded(true);
      if (isManualRefresh) setRefreshing(false);
    }
  }, []);

  // 2. Sondage périodique et synchronisation multi-écrans lorsque l'onglet est actif
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let active = true;

    async function tick() {
      if (!active || document.visibilityState === "hidden") return;
      await fetchServerOrders(false);
    }

    void tick();
    timer = setInterval(() => {
      void tick();
    }, 4000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void tick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchServerOrders]);

  // 3. Transmission d'une commande au serveur
  const submitOrder = useCallback(
    async (
      table: string,
      lines: Array<{ id: string; quantity: number }>,
      notes?: string,
    ) => {
      setError(null);
      const isTakeaway = table === "À emporter";
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tableNumber: isTakeaway ? undefined : table,
          isTakeaway,
          notes: notes?.trim() || undefined,
          lines: lines.map((line) => ({
            productId: line.id,
            quantity: line.quantity,
          })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const msg =
          payload?.error ?? "Création de commande refusée par le serveur.";
        setError(msg);
        throw new Error(msg);
      }
      await fetchServerOrders(true);
      return payload.orderId as string;
    },
    [fetchServerOrders],
  );

  // 4. Validation par la caisse
  const validateAtCashier = useCallback(
    async (orderId: string) => {
      setError(null);
      const response = await fetch(`/api/orders/${orderId}/validate`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const msg = payload?.error ?? "Validation refusée par le serveur.";
        setError(msg);
        throw new Error(msg);
      }
      await fetchServerOrders(true);
    },
    [fetchServerOrders],
  );

  // 5. Progression du statut d'un bon de préparation (Cuisine/Bar)
  const updateTicket = useCallback(
    async (orderId: string, ticketId: string, status: TicketStatus) => {
      setError(null);
      const response = await fetch(
        `/api/orders/${orderId}/tickets/${ticketId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const msg =
          payload?.error ?? "Mise à jour du bon refusée par le serveur.";
        setError(msg);
        throw new Error(msg);
      }
      await fetchServerOrders(true);
    },
    [fetchServerOrders],
  );

  return {
    orders,
    tables,
    loaded,
    isLive,
    error,
    refreshing,
    refresh: () => fetchServerOrders(true),
    submitOrder,
    validateAtCashier,
    updateTicket,
  };
}
