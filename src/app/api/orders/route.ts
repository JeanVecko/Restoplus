import { isSameOrigin, noStoreJson } from "@/server/api/security";
import { getAuthenticatedActor } from "@/server/auth/session";
import { createOrderRequestSchema } from "@/server/orders/request";
import {
  createOrderService,
  listDiningTablesService,
  listOrdersService,
  OrderPrerequisiteError,
} from "@/server/orders/service";

export async function GET() {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  }

  try {
    const [rawOrders, tables] = await Promise.all([
      listOrdersService(actor),
      listDiningTablesService(actor),
    ]);
    const orders = rawOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      number: order.orderNumber,
      tableName: order.tableName,
      table: order.tableName,
      serverName: order.serverName,
      createdBy: order.serverName,
      status: order.status,
      coversCount: order.coversCount,
      isTakeaway: order.isTakeaway,
      notes: order.notes,
      createdAt:
        order.createdAt instanceof Date
          ? order.createdAt.toISOString()
          : order.createdAt,
      cashierValidatedAt:
        order.cashierValidatedAt instanceof Date
          ? order.cashierValidatedAt.toISOString()
          : order.cashierValidatedAt,
      lines: (order.lines ?? []).map((line) => ({
        id: line.id,
        productId: line.productId,
        name: line.productName,
        productName: line.productName,
        station: line.station,
        quantity: line.quantity,
        amount: Number(line.unitPriceAmount),
        unitPriceAmount: line.unitPriceAmount,
        currency: line.currency,
        selectedAccompaniments: line.selectedAccompaniments,
        selectedExtras: line.selectedExtras,
        notes: line.notes,
      })),
      tickets: (order.tickets ?? []).map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        number: ticket.ticketNumber,
        station: ticket.station,
        status: ticket.status,
        items: (Array.isArray(ticket.itemsSummary)
          ? ticket.itemsSummary
          : []
        ).map((item: unknown) => {
          const rec =
            typeof item === "object" && item !== null
              ? (item as Record<string, unknown>)
              : {};
          return {
            id: String(rec.productId ?? rec.id ?? ""),
            name: String(rec.productName ?? rec.name ?? ""),
            station: (rec.station ?? ticket.station) as "CUISINE" | "BAR",
            quantity: typeof rec.quantity === "number" ? rec.quantity : 1,
            amount: Number(rec.unitPriceAmount ?? rec.amount ?? 0),
            currency: (rec.currency ?? "CDF") as "CDF" | "USD",
          };
        }),
        itemsSummary: ticket.itemsSummary,
        issuedAt:
          ticket.issuedAt instanceof Date
            ? ticket.issuedAt.toISOString()
            : ticket.issuedAt,
        readyAt:
          ticket.readyAt instanceof Date
            ? ticket.readyAt.toISOString()
            : ticket.readyAt,
      })),
    }));

    return noStoreJson({ orders, tables });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Erreur serveur." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  }

  const actor = await getAuthenticatedActor();
  if (!actor) {
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createOrderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson(
      {
        error: "Données de commande invalides.",
        details: parsed.error.format(),
      },
      { status: 400 },
    );
  }

  try {
    const orderId = await createOrderService(actor, parsed.data);
    return noStoreJson({ orderId, status: "WAITING_CASHIER" }, { status: 201 });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Erreur serveur." },
      { status: error instanceof OrderPrerequisiteError ? 503 : 400 },
    );
  }
}
