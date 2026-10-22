import { isSameOrigin, noStoreJson } from "@/server/api/security";
import { getAuthenticatedActor } from "@/server/auth/session";
import { canManageCatalog } from "@/server/catalog/authorization";
import { updateProductSchema } from "@/server/catalog/request";
import {
  CatalogError,
  deactivateMenuProduct,
  updateMenuProduct,
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
  if (!canManageCatalog(actor.role))
    return noStoreJson({ error: "Action non autorisée." }, { status: 403 });
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(productId))
    return noStoreJson(
      { error: "Identifiant d’article invalide." },
      { status: 400 },
    );
  const body = await request.json().catch(() => null);
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success)
    return noStoreJson(
      { error: "Modification invalide.", details: parsed.error.format() },
      { status: 400 },
    );
  try {
    return noStoreJson(await updateMenuProduct(actor, productId, parsed.data));
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

// Kept for clients that use DELETE; the operation is a logical deactivation.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  if (!canManageCatalog(actor.role))
    return noStoreJson({ error: "Action non autorisée." }, { status: 403 });
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(productId))
    return noStoreJson(
      { error: "Identifiant d’article invalide." },
      { status: 400 },
    );
  try {
    return noStoreJson(await deactivateMenuProduct(actor, productId));
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
