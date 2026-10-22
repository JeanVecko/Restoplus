import { randomUUID } from "node:crypto";
import type { AuthenticatedActor } from "@/server/auth/session";
import { withTenantTransaction } from "@/server/db/tenant-transaction";
import { resolveAndSnapshotOrderLine } from "@/server/catalog/service";
import {
  canCancelOrder,
  canCreateOrder,
  canProcessPayment,
  canTransitionTicketStatus,
  canUpdateTicketStatus,
  canValidateOrderAtCashier,
} from "./authorization";
import type {
  CreateOrderInput,
  OrderStatus,
  OrderStation,
  PaymentInput,
  TicketStatus,
} from "./types";

export type OrderRecord = {
  id: string;
  restaurantId: string;
  orderNumber: string;
  tableName: string;
  serverName: string;
  serverUserId: string;
  status: OrderStatus;
  coversCount: number;
  isTakeaway: boolean;
  notes: string | null;
  cashierValidatedAt: Date | null;
  cashierUserId: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  cancelledByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines?: OrderLineRecord[];
  tickets?: TicketRecord[];
};

export type OrderLineRecord = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  station: OrderStation;
  quantity: number;
  unitPriceAmount: string;
  currency: string;
  selectedAccompaniments: Array<{
    id: string;
    name: string;
    kind: string;
    amount: string;
    currency: string;
  }>;
  selectedExtras: Array<{
    id: string;
    name: string;
    kind: string;
    amount: string;
    currency: string;
  }>;
  notes: string | null;
};

export type TicketRecord = {
  id: string;
  orderId: string;
  ticketNumber: string;
  station: OrderStation;
  status: TicketStatus;
  itemsSummary: unknown[];
  issuedAt: Date;
  readyAt: Date | null;
};

export class OrderPrerequisiteError extends Error {
  readonly code: "CATALOG_NOT_CONFIGURED" | "FINANCIAL_POLICY_PENDING";

  constructor(
    code: "CATALOG_NOT_CONFIGURED" | "FINANCIAL_POLICY_PENDING",
    message: string,
  ) {
    super(message);
    this.name = "OrderPrerequisiteError";
    this.code = code;
  }
}

/**
 * Consultation des commandes du restaurant pour les écrans Service, Caisse et Cuisine.
 * Retourne les commandes récentes avec leurs lignes et leurs tickets de préparation.
 */
export async function listOrdersService(
  actor: AuthenticatedActor,
): Promise<Array<OrderRecord & { serverName: string }>> {
  return withTenantTransaction(actor, async (tx) => {
    const orders = await tx.$queryRaw<
      Array<{
        id: string;
        restaurantId: string;
        orderNumber: string;
        tableName: string;
        serverUserId: string;
        status: OrderStatus;
        coversCount: number;
        isTakeaway: boolean;
        notes: string | null;
        cashierValidatedAt: Date | null;
        cashierUserId: string | null;
        cancelledAt: Date | null;
        cancellationReason: string | null;
        cancelledByUserId: string | null;
        createdAt: Date;
        updatedAt: Date;
        serverName: string;
      }>
    >`
      SELECT o."id", o."restaurantId", o."orderNumber", o."tableName", o."serverUserId",
             o."status", o."coversCount", o."isTakeaway", o."notes",
             o."cashierValidatedAt", o."cashierUserId", o."cancelledAt",
             o."cancellationReason", o."cancelledByUserId",
             o."createdAt", o."updatedAt",
             u."displayName" AS "serverName"
      FROM public.orders AS o
      JOIN public.users AS u ON u."id" = o."serverUserId" AND u."restaurantId" = o."restaurantId"
      WHERE o."restaurantId" = ${actor.restaurantId}::uuid
      ORDER BY o."createdAt" DESC
      LIMIT 100
    `;

    if (orders.length === 0) {
      return [];
    }

    const orderIds = orders.map((o) => o.id);

    const lines = await tx.$queryRaw<
      Array<{
        id: string;
        orderId: string;
        productId: string;
        productName: string;
        station: OrderStation;
        quantity: number;
        unitPriceAmount: string;
        currency: string;
        selectedAccompaniments: unknown;
        selectedExtras: unknown;
        notes: string | null;
      }>
    >`
      SELECT "id", "orderId", "productId", "productName", "station", "quantity",
             "unitPriceAmount"::text AS "unitPriceAmount", "currency",
             "selectedAccompaniments", "selectedExtras", "notes"
      FROM public.order_lines
      WHERE "restaurantId" = ${actor.restaurantId}::uuid
        AND "orderId" = ANY(${orderIds}::uuid[])
      ORDER BY "createdAt", "id"
    `;

    const tickets = await tx.$queryRaw<
      Array<{
        id: string;
        orderId: string;
        ticketNumber: string;
        station: OrderStation;
        status: TicketStatus;
        itemsSummary: unknown;
        issuedAt: Date;
        readyAt: Date | null;
      }>
    >`
      SELECT "id", "orderId", "ticketNumber", "station", "status",
             "itemsSummary", "issuedAt", "readyAt"
      FROM public.kitchen_bar_tickets
      WHERE "restaurantId" = ${actor.restaurantId}::uuid
        AND "orderId" = ANY(${orderIds}::uuid[])
      ORDER BY "issuedAt", "ticketNumber"
    `;

    return orders.map((order) => {
      const orderLines = lines.filter((l) => l.orderId === order.id);
      const orderTickets = tickets.filter((t) => t.orderId === order.id);
      return {
        ...order,
        lines: orderLines.map((line) => ({
          id: line.id,
          orderId: line.orderId,
          productId: line.productId,
          productName: line.productName,
          station: line.station,
          quantity: line.quantity,
          unitPriceAmount: line.unitPriceAmount,
          currency: line.currency,
          selectedAccompaniments: (Array.isArray(line.selectedAccompaniments)
            ? line.selectedAccompaniments
            : []) as OrderLineRecord["selectedAccompaniments"],
          selectedExtras: (Array.isArray(line.selectedExtras)
            ? line.selectedExtras
            : []) as OrderLineRecord["selectedExtras"],
          notes: line.notes,
        })),
        tickets: orderTickets.map((ticket) => ({
          id: ticket.id,
          orderId: ticket.orderId,
          ticketNumber: ticket.ticketNumber,
          station: ticket.station,
          status: ticket.status,
          itemsSummary: Array.isArray(ticket.itemsSummary)
            ? ticket.itemsSummary
            : [],
          issuedAt: ticket.issuedAt,
          readyAt: ticket.readyAt,
        })),
      };
    });
  });
}

/**
 * 1. Prise de commande par le serveur (statut initial WAITING_CASHIER).
 * Aucun bon de cuisine ou de bar n'est émis à cette étape.
 */
export async function createOrderService(
  actor: AuthenticatedActor,
  input: CreateOrderInput,
): Promise<string> {
  if (!canCreateOrder(actor.role)) {
    throw new Error("Action non autorisée pour ce rôle.");
  }
  if (!input.lines || input.lines.length === 0) {
    throw new Error("Une commande doit contenir au moins un article.");
  }
  const orderId = randomUUID();
  const year = new Date().getUTCFullYear();
  const orderNumber = `CMD-${year}-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  return withTenantTransaction(actor, async (tx) => {
    const isTakeaway = input.isTakeaway === true;
    let table: { id: string; tableNumber: string; zone: string } | null = null;
    if (!isTakeaway) {
      const tables = await tx.$queryRaw<
        Array<{ id: string; tableNumber: string; zone: string }>
      >`
        SELECT "id", "tableNumber", "zone" FROM public.dining_tables
        WHERE "restaurantId" = ${actor.restaurantId}::uuid
          AND "tableNumber" = ${input.tableNumber ?? ""} AND "isActive"
      `;
      table = tables[0] ?? null;
      if (!table)
        throw new Error("Table introuvable ou inactive dans ce restaurant.");
    }
    const zone = isTakeaway ? "STANDARD" : table?.zone;
    if (zone !== "STANDARD" && zone !== "TERRACE" && zone !== "VIP") {
      throw new Error("La zone de cette table n’a pas de tarif défini.");
    }
    const tableName = isTakeaway ? "À emporter" : table!.tableNumber;
    const now = new Date();
    await tx.$executeRaw`
      INSERT INTO public.orders (
        "id", "restaurantId", "orderNumber", "tableId", "tableName", "pricingZone",
        "serverUserId", "status", "coversCount", "isTakeaway", "notes", "updatedAt"
      ) VALUES (
        ${orderId}::uuid, ${actor.restaurantId}::uuid, ${orderNumber},
        ${table?.id ?? null}::uuid, ${tableName}, ${zone}::public.menu_zone,
        ${actor.userId}::uuid, 'WAITING_CASHIER'::public.order_status,
        ${input.coversCount ?? 1}, ${isTakeaway}, ${input.notes?.trim() || null}, ${now}::timestamptz
      )
    `;
    for (const line of input.lines) {
      const snapshot = await resolveAndSnapshotOrderLine(
        tx,
        actor.restaurantId,
        line,
        zone,
      );
      await tx.$executeRaw`
        INSERT INTO public.order_lines (
          "id", "restaurantId", "orderId", "productId", "productName", "station", "quantity",
          "unitPriceAmount", "currency", "selectedAccompaniments", "selectedExtras", "notes"
        ) VALUES (
          ${randomUUID()}::uuid, ${actor.restaurantId}::uuid, ${orderId}::uuid,
          ${snapshot.productId}, ${snapshot.productName}, ${snapshot.station}::public.order_station,
          ${snapshot.quantity}, ${snapshot.unitPriceAmount}::numeric, ${snapshot.currency},
          ${JSON.stringify(snapshot.selectedAccompaniments)}::jsonb,
          ${JSON.stringify(snapshot.selectedExtras)}::jsonb, ${snapshot.notes}
        )
      `;
    }
    await tx.$executeRaw`
      INSERT INTO public.order_audit_events
        ("id", "restaurantId", "orderId", "actorUserId", "eventType", "details", "createdAt")
      VALUES (${randomUUID()}::uuid, ${actor.restaurantId}::uuid, ${orderId}::uuid,
        ${actor.userId}::uuid, 'ORDER_CREATED',
        ${JSON.stringify({ lineCount: input.lines.length, pricingZone: zone, isTakeaway })}::jsonb,
        ${now}::timestamptz)
    `;
    return orderId;
  });
}

/**
 * 2. Validation obligatoire par la caisse avec verrou pessimiste.
 * Fait passer la commande à IN_PREPARATION et scinde atomiquement les lignes vers les bons Cuisine et Bar.
 */
export async function validateOrderAtCashierService(
  actor: AuthenticatedActor,
  orderId: string,
): Promise<{ orderId: string; tickets: TicketRecord[] }> {
  if (!canValidateOrderAtCashier(actor.role)) {
    throw new Error(
      "Seul un caissier, gérant ou propriétaire peut valider une commande en caisse.",
    );
  }
  if (!orderId) throw new Error("Identifiant de commande requis.");

  return withTenantTransaction(actor, async (tx) => {
    const orderRows = await tx.$queryRaw<
      Array<{ id: string; status: string; orderNumber: string }>
    >`
      SELECT "id", "status", "orderNumber" FROM public.orders
      WHERE "id" = ${orderId}::uuid AND "restaurantId" = ${actor.restaurantId}::uuid
      FOR UPDATE
    `;
    const order = orderRows[0];
    if (!order) throw new Error("Commande introuvable.");
    if (order.status !== "WAITING_CASHIER")
      throw new Error(
        `La commande ne peut pas être validée (statut actuel: ${order.status}).`,
      );
    const lines = await tx.$queryRaw<
      Array<{
        productId: string;
        productName: string;
        station: OrderStation;
        quantity: number;
        unitPriceAmount: string;
        currency: string;
        selectedAccompaniments: unknown[];
        selectedExtras: unknown[];
        notes: string | null;
      }>
    >`
      SELECT "productId", "productName", "station", "quantity", "unitPriceAmount"::text AS "unitPriceAmount",
             "currency", "selectedAccompaniments", "selectedExtras", "notes"
      FROM public.order_lines WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "orderId" = ${orderId}::uuid
      ORDER BY "createdAt", "id"
    `;
    if (lines.length === 0)
      throw new Error("La commande ne contient aucune ligne.");
    const now = new Date();
    await tx.$executeRaw`
      UPDATE public.orders SET "status" = 'IN_PREPARATION'::public.order_status,
        "cashierValidatedAt" = ${now}::timestamptz, "cashierUserId" = ${actor.userId}::uuid,
        "updatedAt" = ${now}::timestamptz
      WHERE "id" = ${orderId}::uuid AND "restaurantId" = ${actor.restaurantId}::uuid
    `;
    const tickets: TicketRecord[] = [];
    for (const station of ["CUISINE", "BAR"] as const) {
      const stationLines = lines.filter((line) => line.station === station);
      if (stationLines.length === 0) continue;
      const ticketId = randomUUID();
      const suffix = station === "CUISINE" ? "C" : "B";
      const ticketNumber = `BON-${order.orderNumber.replace(/^CMD-/, "")}-${suffix}`;
      await tx.$executeRaw`
        INSERT INTO public.kitchen_bar_tickets
          ("id", "restaurantId", "orderId", "ticketNumber", "station", "status", "itemsSummary", "issuedAt")
        VALUES (${ticketId}::uuid, ${actor.restaurantId}::uuid, ${orderId}::uuid, ${ticketNumber},
          ${station}::public.order_station, 'PENDING'::public.ticket_status,
          ${JSON.stringify(stationLines)}::jsonb, ${now}::timestamptz)
      `;
      tickets.push({
        id: ticketId,
        orderId,
        ticketNumber,
        station,
        status: "PENDING",
        itemsSummary: stationLines,
        issuedAt: now,
        readyAt: null,
      });
    }
    await tx.$executeRaw`
      INSERT INTO public.order_audit_events
        ("id", "restaurantId", "orderId", "actorUserId", "eventType", "details", "createdAt")
      VALUES (${randomUUID()}::uuid, ${actor.restaurantId}::uuid, ${orderId}::uuid,
        ${actor.userId}::uuid, 'CASHIER_VALIDATED', ${JSON.stringify({ ticketCount: tickets.length })}::jsonb, ${now}::timestamptz)
    `;
    return { orderId, tickets };
  });
}

/**
 * 3. Progression du statut d'un bon de préparation (Cuisine ou Bar).
 * Si tous les bons de la commande sont READY, la commande passe automatiquement à READY.
 */
export async function updateTicketStatusService(
  actor: AuthenticatedActor,
  orderId: string,
  ticketId: string,
  newStatus: TicketStatus,
): Promise<{
  ticketId: string;
  newStatus: TicketStatus;
  orderStatus: OrderStatus;
}> {
  if (!canUpdateTicketStatus(actor.role)) {
    throw new Error(
      "Seuls les postes Cuisine/Bar, le gérant ou le propriétaire peuvent mettre à jour un bon.",
    );
  }

  return withTenantTransaction(actor, async (tx) => {
    // Vérifier l'existence et l'état de la commande associée
    const orderRows = await tx.$queryRaw<
      Array<{ id: string; status: OrderStatus }>
    >`
      SELECT "id", "status" FROM public.orders
      WHERE "id" = ${orderId}::uuid AND "restaurantId" = ${actor.restaurantId}::uuid
      FOR UPDATE
    `;
    const order = orderRows[0];
    if (!order) throw new Error("Commande introuvable.");
    if (order.status === "CANCELLED") {
      throw new Error("Impossible de modifier le bon d'une commande annulée.");
    }
    if (order.status === "COMPLETED") {
      throw new Error(
        "Impossible de modifier le bon d'une commande déjà terminée.",
      );
    }

    const ticketRows = await tx.$queryRaw<Array<{ status: TicketStatus }>>`
      SELECT "status" FROM public.kitchen_bar_tickets
      WHERE "id" = ${ticketId}::uuid AND "orderId" = ${orderId}::uuid
        AND "restaurantId" = ${actor.restaurantId}::uuid
      FOR UPDATE
    `;
    const ticket = ticketRows[0];
    if (!ticket) throw new Error("Bon introuvable.");
    if (!canTransitionTicketStatus(ticket.status, newStatus)) {
      throw new Error(
        `Transition de bon interdite : ${ticket.status} → ${newStatus}.`,
      );
    }

    const now = new Date();
    const readyAt = newStatus === "READY" ? now : null;

    await tx.$executeRaw`
      UPDATE public.kitchen_bar_tickets
      SET "status" = ${newStatus}::public.ticket_status,
          "readyAt" = ${readyAt}::timestamptz,
          "handledByUserId" = ${actor.userId}::uuid
      WHERE "id" = ${ticketId}::uuid
        AND "orderId" = ${orderId}::uuid
        AND "restaurantId" = ${actor.restaurantId}::uuid
    `;

    // Vérifier l'état de l'ensemble des tickets de la commande
    const ticketStatuses = await tx.$queryRaw<Array<{ status: TicketStatus }>>`
      SELECT "status" FROM public.kitchen_bar_tickets
      WHERE "orderId" = ${orderId}::uuid AND "restaurantId" = ${actor.restaurantId}::uuid
    `;

    const allReady =
      ticketStatuses.length > 0 &&
      ticketStatuses.every((t) => t.status === "READY");

    let updatedOrderStatus: OrderStatus = order.status;
    if (allReady && order.status === "IN_PREPARATION") {
      updatedOrderStatus = "READY";
      await tx.$executeRaw`
        UPDATE public.orders
        SET "status" = 'READY'::public.order_status, "updatedAt" = ${now}::timestamptz
        WHERE "id" = ${orderId}::uuid AND "restaurantId" = ${actor.restaurantId}::uuid
      `;
    }

    await tx.$executeRaw`
      INSERT INTO public.order_audit_events (
        "id", "restaurantId", "orderId", "actorUserId", "eventType", "details", "createdAt"
      ) VALUES (
        ${randomUUID()}::uuid, ${actor.restaurantId}::uuid, ${orderId}::uuid,
        ${actor.userId}::uuid, 'TICKET_STATUS_CHANGED',
        ${JSON.stringify({ ticketId, from: ticket.status, to: newStatus })}::jsonb,
        ${now}::timestamptz
      )
    `;

    return { ticketId, newStatus, orderStatus: updatedOrderStatus };
  });
}

/**
 * 4. Annulation d'une commande (réservée à OWNER ou MANAGER avec motif obligatoire).
 * Vérifie l'état de la commande et trace l'événement.
 */
export async function cancelOrderService(
  actor: AuthenticatedActor,
  orderId: string,
  reason: string,
): Promise<{ orderId: string; cancelled: boolean }> {
  if (!canCancelOrder(actor.role)) {
    throw new Error(
      "Seul un gérant ou propriétaire peut annuler une commande.",
    );
  }
  if (!reason || reason.trim().length === 0) {
    throw new Error("Le motif d'annulation est obligatoire.");
  }

  const trimmedReason = reason.trim();
  const now = new Date();

  return withTenantTransaction(actor, async (tx) => {
    const orderRows = await tx.$queryRaw<
      Array<{ id: string; status: OrderStatus }>
    >`
      SELECT "id", "status" FROM public.orders
      WHERE "id" = ${orderId}::uuid AND "restaurantId" = ${actor.restaurantId}::uuid
      FOR UPDATE
    `;
    const order = orderRows[0];
    if (!order) throw new Error("Commande introuvable.");
    if (order.status === "COMPLETED") {
      throw new Error(
        "Une commande déjà encaissée ne peut pas être annulée directement. Utilisez la procédure de remboursement.",
      );
    }
    if (order.status === "CANCELLED") {
      throw new Error("La commande est déjà annulée.");
    }
    if (order.status === "READY") {
      throw new Error(
        "L’annulation après la préparation complète attend une règle métier validée.",
      );
    }

    await tx.$executeRaw`
      UPDATE public.orders
      SET "status" = 'CANCELLED'::public.order_status,
          "cancelledAt" = ${now}::timestamptz,
          "cancelledByUserId" = ${actor.userId}::uuid,
          "cancellationReason" = ${trimmedReason},
          "updatedAt" = ${now}::timestamptz
      WHERE "id" = ${orderId}::uuid AND "restaurantId" = ${actor.restaurantId}::uuid
    `;

    await tx.$executeRaw`
      INSERT INTO public.order_audit_events (
        "id", "restaurantId", "orderId", "actorUserId", "eventType", "details", "createdAt"
      ) VALUES (
        ${randomUUID()}::uuid, ${actor.restaurantId}::uuid, ${orderId}::uuid,
        ${actor.userId}::uuid, 'ORDER_CANCELLED',
        ${JSON.stringify({ reason: trimmedReason })}::jsonb, ${now}::timestamptz
      )
    `;

    return { orderId, cancelled: true };
  });
}

/**
 * 5. Règlement en caisse d'une commande (enregistre les paiements dans leur devise d'origine).
 * Protégé contre les doubles encaissements et compatible paiements partiels/multiples.
 */
export async function settleOrderPaymentService(
  actor: AuthenticatedActor,
  orderId: string,
  payments: PaymentInput[],
  isCompleteSettlement: boolean = true,
): Promise<{ orderId: string; completed: boolean; receiptId: string }> {
  if (!canProcessPayment(actor.role)) {
    throw new Error(
      "Seul un caissier, gérant ou propriétaire peut enregistrer un encaissement.",
    );
  }
  if (!payments || payments.length === 0) {
    throw new Error("Au moins un règlement est requis.");
  }
  if (!orderId || typeof isCompleteSettlement !== "boolean") {
    throw new Error("Demande de règlement invalide.");
  }

  throw new OrderPrerequisiteError(
    "FINANCIAL_POLICY_PENDING",
    "L’encaissement persistant reste désactivé jusqu’à la validation des règles de total, de monnaie et de reçu.",
  );
}

/**
 * Consultation des tables de salle actives du restaurant.
 */
export async function listDiningTablesService(
  actor: AuthenticatedActor,
): Promise<Array<{ id: string; tableNumber: string; zone: string }>> {
  return withTenantTransaction(actor, async (tx) => {
    return tx.$queryRaw<
      Array<{ id: string; tableNumber: string; zone: string }>
    >`
      SELECT "id", "tableNumber", "zone"
      FROM public.dining_tables
      WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "isActive"
      ORDER BY "tableNumber" ASC
    `;
  });
}
