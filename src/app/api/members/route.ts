import { NextResponse } from "next/server";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { getAuthenticatedActor } from "@/server/auth/session";
import { withTenantTransaction } from "@/server/db/tenant-transaction";
import { isSameOrigin, noStoreJson } from "@/server/api/security";

const inviteSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["MANAGER", "CASHIER", "WAITER", "KITCHEN", "STOCK_MANAGER"]),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

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
  const members = await withTenantTransaction(actor, (tx) =>
    tx.user.findMany({
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        isActive: true,
        membership: { select: { role: true, isActive: true } },
      },
    }),
  );
  return noStoreJson({ members });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  if (actor.role !== "OWNER" && actor.role !== "MANAGER") {
    return noStoreJson({ error: "Permission insuffisante." }, { status: 403 });
  }
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return noStoreJson(
      { error: "Données d’invitation invalides." },
      { status: 400 },
    );

  const emailNormalized = normalizeEmail(parsed.data.email);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invitationId = randomUUID();
  // Seven days is the current technical default; confirm the business expiry policy before production.
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  try {
    await withTenantTransaction(
      actor,
      (tx) =>
        tx.$queryRaw`
        SELECT * FROM restoplus_private.create_membership_invitation(
          ${invitationId}::uuid, ${emailNormalized}, ${parsed.data.role}::public.membership_role,
          ${tokenHash}, ${expiresAt}::timestamptz
        )
      `,
    );
  } catch {
    return noStoreJson(
      { error: "L’invitation n’a pas pu être créée." },
      { status: 409 },
    );
  }
  // No email provider is configured. The one-time token must be delivered through an approved secure channel.
  return noStoreJson(
    {
      invitationId,
      invitationToken: token,
      expiresAt: expiresAt.toISOString(),
    },
    { status: 201 },
  );
}
