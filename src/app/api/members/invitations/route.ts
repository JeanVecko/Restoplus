import { NextResponse } from "next/server";
import { getAuthenticatedActor } from "@/server/auth/session";
import { withTenantTransaction } from "@/server/db/tenant-transaction";
import { noStoreJson } from "@/server/api/security";

export async function GET() {
  const actor = await getAuthenticatedActor();
  if (!actor)
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  if (actor.role !== "OWNER" && actor.role !== "MANAGER") {
    return NextResponse.json(
      { error: "Permission insuffisante." },
      { status: 403 },
    );
  }
  try {
    const invitations = await withTenantTransaction(
      actor,
      (tx) =>
        tx.$queryRaw<
          Array<{
            invitationId: string;
            emailNormalized: string;
            role: string;
            createdAt: Date;
            expiresAt: Date;
          }>
        >`SELECT * FROM restoplus_private.list_membership_invitations()`,
    );
    return noStoreJson({ invitations });
  } catch {
    return noStoreJson(
      { error: "Les invitations ne peuvent pas être chargées." },
      { status: 503 },
    );
  }
}
