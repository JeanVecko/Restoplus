import { isSameOrigin, noStoreJson } from "@/server/api/security";
import { getAuthenticatedActor } from "@/server/auth/session";
import {
  OrderPrerequisiteError,
  validateOrderAtCashierService,
} from "@/server/orders/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isSameOrigin(request)) {
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  }

  const actor = await getAuthenticatedActor();
  if (!actor) {
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return noStoreJson(
      { error: "Identifiant de commande invalide." },
      { status: 400 },
    );
  }

  try {
    const result = await validateOrderAtCashierService(actor, orderId);
    return noStoreJson({
      validated: true,
      orderId: result.orderId,
      status: "IN_PREPARATION",
      ticketsCount: result.tickets.length,
      tickets: result.tickets,
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur de validation en caisse.",
      },
      { status: error instanceof OrderPrerequisiteError ? 409 : 400 },
    );
  }
}
