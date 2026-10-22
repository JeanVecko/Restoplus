import { z } from "zod";
import { getAuthenticatedActor } from "@/server/auth/session";
import { withTenantTransaction } from "@/server/db/tenant-transaction";
import { isSameOrigin, noStoreJson } from "@/server/api/security";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  if (actor.role !== "OWNER" && actor.role !== "MANAGER")
    return noStoreJson({ error: "Permission insuffisante." }, { status: 403 });
  const { invitationId } = await context.params;
  if (!z.string().uuid().safeParse(invitationId).success)
    return noStoreJson({ error: "Identifiant invalide." }, { status: 400 });
  try {
    await withTenantTransaction(
      actor,
      (tx) =>
        tx.$executeRaw`SELECT restoplus_private.cancel_membership_invitation(${invitationId}::uuid)`,
    );
  } catch {
    return noStoreJson(
      { error: "L’invitation ne peut pas être annulée." },
      { status: 409 },
    );
  }
  return noStoreJson({ cancelled: true });
}
