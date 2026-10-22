import { isSameOrigin, noStoreJson } from "@/server/api/security";
import { getAuthenticatedActor } from "@/server/auth/session";
import { canManageCatalog } from "@/server/catalog/authorization";
import { updateCategorySchema } from "@/server/catalog/request";
import { CatalogError, updateMenuCategory } from "@/server/catalog/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  if (!canManageCatalog(actor.role))
    return noStoreJson({ error: "Action non autorisée." }, { status: 403 });
  const { categoryId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(categoryId))
    return noStoreJson(
      { error: "Identifiant de catégorie invalide." },
      { status: 400 },
    );
  const body = await request.json().catch(() => null);
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success)
    return noStoreJson(
      { error: "Modification invalide.", details: parsed.error.format() },
      { status: 400 },
    );
  try {
    return noStoreJson(
      await updateMenuCategory(actor, categoryId, parsed.data),
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
