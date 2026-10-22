import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createHash } from "node:crypto";
import { authPrisma } from "@/server/db/auth-prisma";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { isSameOrigin, noStoreJson } from "@/server/api/security";

const acceptSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  displayName: z.string().trim().min(1).max(160),
  password: z.string().min(12).max(256),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const parsed = acceptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return noStoreJson(
      { error: "Invitation ou informations invalides." },
      { status: 400 },
    );
  const userId = randomUUID();
  const tokenHash = createHash("sha256")
    .update(parsed.data.token)
    .digest("hex");
  const validRows = await authPrisma.$queryRaw<
    Array<{ invitation_is_valid: boolean }>
  >`
    SELECT restoplus_private.invitation_is_valid(${tokenHash}) AS invitation_is_valid
  `;
  if (!validRows[0]?.invitation_is_valid) {
    return noStoreJson(
      { error: "Invitation invalide, expirée ou déjà utilisée." },
      { status: 400 },
    );
  }
  const passwordHash = await hashPassword(parsed.data.password);
  try {
    const accepted = await authPrisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ restaurantId: string; userId: string }>
      >`
        SELECT * FROM restoplus_private.accept_membership_invitation(
          ${tokenHash}, ${userId}::uuid, ${parsed.data.displayName}, ${passwordHash}
        )
      `;
      return rows[0];
    });
    if (!accepted)
      throw new Error("Invitation acceptance returned no account.");
    const sessionToken = await createSession(
      accepted.restaurantId,
      accepted.userId,
    );
    await setSessionCookie(sessionToken);
    return noStoreJson({ accepted: true });
  } catch {
    return noStoreJson(
      { error: "Invitation invalide, expirée ou déjà utilisée." },
      { status: 400 },
    );
  }
}
