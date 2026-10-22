import { z } from "zod";
import { getAuthenticatedActor } from "@/server/auth/session";
import { withTenantTransaction } from "@/server/db/tenant-transaction";
import { canManageMember } from "@/server/accounts/authorization";
import { isSameOrigin, noStoreJson } from "@/server/api/security";
import { clearSessionCookie } from "@/server/auth/session";

const updateSchema = z
  .object({
    role: z
      .enum([
        "OWNER",
        "MANAGER",
        "CASHIER",
        "WAITER",
        "KITCHEN",
        "STOCK_MANAGER",
      ])
      .optional(),
    membershipActive: z.boolean().optional(),
    userActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined));

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  if (actor.role !== "OWNER" && actor.role !== "MANAGER")
    return noStoreJson({ error: "Permission insuffisante." }, { status: 403 });
  const { userId } = await context.params;
  if (!z.string().uuid().safeParse(userId).success)
    return noStoreJson({ error: "Identifiant invalide." }, { status: 400 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return noStoreJson({ error: "Modification invalide." }, { status: 400 });

  try {
    await withTenantTransaction(actor, async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, membership: { select: { role: true } } },
      });
      if (!target?.membership) throw new Error("MEMBER_NOT_FOUND");
      if (
        !canManageMember({
          actorId: actor.userId,
          actorRole: actor.role,
          targetId: target.id,
          targetRole: target.membership.role,
          newRole: parsed.data.role,
        })
      )
        throw new Error("FORBIDDEN");
      await tx.$executeRaw`
        SELECT restoplus_private.manage_member(
          ${userId}::uuid,
          ${parsed.data.role ?? null}::public.membership_role,
          ${parsed.data.membershipActive ?? null}::boolean,
          ${parsed.data.userActive ?? null}::boolean
        )
      `;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "FORBIDDEN"
        ? 403
        : message === "MEMBER_NOT_FOUND"
          ? 404
          : 409;
    return noStoreJson(
      {
        error:
          status === 403
            ? "Permission insuffisante."
            : status === 404
              ? "Membre introuvable."
              : "La modification a été refusée.",
      },
      { status },
    );
  }
  if (
    userId === actor.userId &&
    (parsed.data.userActive === false || parsed.data.membershipActive === false)
  ) {
    await clearSessionCookie();
  }
  return noStoreJson({ updated: true });
}
