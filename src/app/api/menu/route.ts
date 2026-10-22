import { noStoreJson } from "@/server/api/security";
import { getAuthenticatedActor } from "@/server/auth/session";
import { listMenuCatalog } from "@/server/catalog/service";

export async function GET() {
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  try {
    return noStoreJson(await listMenuCatalog(actor));
  } catch {
    return noStoreJson(
      { error: "Impossible de charger la carte." },
      { status: 503 },
    );
  }
}
