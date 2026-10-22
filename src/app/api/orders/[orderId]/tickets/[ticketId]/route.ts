import { z } from "zod";
import { isSameOrigin, noStoreJson } from "@/server/api/security";
import { getAuthenticatedActor } from "@/server/auth/session";
import { updateTicketStatusService } from "@/server/orders/service";

const updateSchema = z.object({
  status: z.enum(["PENDING", "IN_PREPARATION", "READY"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string; ticketId: string }> },
) {
  if (!isSameOrigin(request)) {
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  }

  const actor = await getAuthenticatedActor();
  if (!actor) {
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  }

  const { orderId, ticketId } = await params;
  if (
    !orderId ||
    !ticketId ||
    !/^[0-9a-f-]{36}$/i.test(orderId) ||
    !/^[0-9a-f-]{36}$/i.test(ticketId)
  ) {
    return noStoreJson({ error: "Paramètres invalides." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: "Statut de bon invalide." }, { status: 400 });
  }

  try {
    const result = await updateTicketStatusService(
      actor,
      orderId,
      ticketId,
      parsed.data.status,
    );
    return noStoreJson({
      updated: true,
      ticketId: result.ticketId,
      ticketStatus: result.newStatus,
      orderStatus: result.orderStatus,
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur de mise à jour du bon.",
      },
      { status: 400 },
    );
  }
}
