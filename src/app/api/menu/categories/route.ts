import { isSameOrigin, noStoreJson } from "@/server/api/security";
import { getAuthenticatedActor } from "@/server/auth/session";
import { canManageCatalog } from "@/server/catalog/authorization";
import { createCategorySchema } from "@/server/catalog/request";
import { createMenuCategory } from "@/server/catalog/service";

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  if (!canManageCatalog(actor.role))
    return noStoreJson({ error: "Action non autorisée." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success)
    return noStoreJson(
      { error: "Catégorie invalide.", details: parsed.error.format() },
      { status: 400 },
    );
  try {
    return noStoreJson(await createMenuCategory(actor, parsed.data), {
      status: 201,
    });
  } catch {
    return noStoreJson(
      { error: "La catégorie n’a pas pu être créée." },
      { status: 400 },
    );
  }
}
