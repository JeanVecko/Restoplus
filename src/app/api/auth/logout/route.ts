import {
  getAuthenticatedActor,
  clearSessionCookie,
} from "@/server/auth/session";
import { authPrisma } from "@/server/db/auth-prisma";
import { isSameOrigin, noStoreJson } from "@/server/api/security";

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (actor) {
    await authPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.restaurant_id', ${actor.restaurantId}, true), set_config('app.user_id', ${actor.userId}, true)`;
      await tx.session.update({
        where: { id: actor.sessionId },
        data: { revokedAt: new Date() },
      });
    });
  }
  await clearSessionCookie();
  return noStoreJson({ loggedOut: true });
}
