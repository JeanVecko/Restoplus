import { NextResponse } from "next/server";
import { getAuthenticatedActor } from "@/server/auth/session";
import { withTenantTransaction } from "@/server/db/tenant-transaction";
import { clearSessionCookie } from "@/server/auth/session";
import { isSameOrigin, noStoreJson } from "@/server/api/security";

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  if (actor.role !== "OWNER")
    return noStoreJson(
      { error: "Seul un OWNER peut désactiver le restaurant." },
      { status: 403 },
    );
  try {
    await withTenantTransaction(
      actor,
      (tx) =>
        tx.$executeRaw`SELECT restoplus_private.set_restaurant_active(false)`,
    );
  } catch {
    return noStoreJson(
      { error: "La désactivation a été refusée." },
      { status: 409 },
    );
  }
  await clearSessionCookie();
  return NextResponse.json(
    { deactivated: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
