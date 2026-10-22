import { z } from "zod";
import { isSameOrigin, noStoreJson } from "@/server/api/security";
import { getAuthenticatedActor } from "@/server/auth/session";
import { cancelOrderService } from "@/server/orders/service";

const cancelSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

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

  const body = await request.json().catch(() => null);
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson(
      {
        error: "Le motif d'annulation est obligatoire (au moins 3 caractères).",
      },
      { status: 400 },
    );
  }

  try {
    const result = await cancelOrderService(actor, orderId, parsed.data.reason);
    return noStoreJson({ cancelled: true, orderId: result.orderId });
  } catch (error) {
    return noStoreJson(
      {
        error: error instanceof Error ? error.message : "Erreur d'annulation.",
      },
      { status: 400 },
    );
  }
}
