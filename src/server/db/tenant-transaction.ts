import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedActor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export function withTenantTransaction<T>(
  actor: AuthenticatedActor,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.restaurant_id', ${actor.restaurantId}, true), set_config('app.user_id', ${actor.userId}, true)`;
    return work(tx);
  });
}
