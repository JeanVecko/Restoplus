import { isSameOrigin, noStoreJson } from "@/server/api/security";
import { getAuthenticatedActor } from "@/server/auth/session";
import { canChangeCatalogAvailability } from "@/server/catalog/authorization";
import { productAvailabilitySchema } from "@/server/catalog/request";
import {
  CatalogError,
  setMenuProductAvailability,
} from "@/server/catalog/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  if (!canChangeCatalogAvailability(actor.role))
    return noStoreJson({ error: "Action non autorisée." }, { status: 403 });
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(productId))
    return noStoreJson(
      { error: "Identifiant d’article invalide." },
      { status: 400 },
    );
  const body = await request.json().catch(() => null);
  const parsed = productAvailabilitySchema.safeParse(body);
  if (!parsed.success)
    return noStoreJson({ error: "Disponibilité invalide." }, { status: 400 });
  try {
    return noStoreJson(
      await setMenuProductAvailability(
        actor,
        productId,
        parsed.data.isAvailable,
      ),
    );
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Erreur serveur." },
      {
        status:
          error instanceof CatalogError && error.code === "NOT_FOUND"
            ? 404
            : 400,
      },
    );
  }
}
