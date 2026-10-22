import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { MembershipRole } from "@/generated/prisma/client";
import { authPrisma } from "@/server/db/auth-prisma";

export const SESSION_COOKIE = "restoplus_session";
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const ABSOLUTE_LIMIT_MS = 12 * 60 * 60 * 1000;

export type AuthenticatedActor = {
  sessionId: string;
  restaurantId: string;
  userId: string;
  role: MembershipRole;
  displayName: string;
  restaurantName: string;
  restaurantCode: string;
};

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  restaurantId: string,
  userId: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await authPrisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.restaurant_id', ${restaurantId}, true), set_config('app.user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${restaurantId}, 0))`;
    const activeRows = await tx.$queryRaw<Array<{ active: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM public.restaurants AS r
        JOIN public.users AS u ON u."restaurantId" = r."id"
        JOIN public.memberships AS m ON m."restaurantId" = u."restaurantId" AND m."userId" = u."id"
        WHERE r."id" = ${restaurantId}::uuid AND u."id" = ${userId}::uuid
          AND r."isActive" AND u."isActive" AND m."isActive"
      ) AS active
    `;
    if (!activeRows[0]?.active)
      throw new Error("Cannot create a session for an inactive account.");
    const sessionId = randomUUID();
    const tokenHash = hashSessionToken(token);
    const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_LIMIT_MS);
    await tx.$executeRaw`
      INSERT INTO public.sessions ("id", "restaurantId", "userId", "tokenHash", "absoluteExpiresAt")
      VALUES (${sessionId}::uuid, ${restaurantId}::uuid, ${userId}::uuid, ${tokenHash}, ${absoluteExpiresAt})
    `;
  });
  return token;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_LIMIT_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getAuthenticatedActor(): Promise<AuthenticatedActor | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;

  return authPrisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.session_token_hash', ${hashSessionToken(token)}, true)`;
    const session = await tx.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
    });
    if (!session || session.revokedAt) return null;

    await tx.$queryRaw`SELECT set_config('app.restaurant_id', ${session.restaurantId}, true), set_config('app.user_id', ${session.userId}, true)`;
    const [restaurant, user, membership] = await Promise.all([
      tx.restaurant.findUnique({ where: { id: session.restaurantId } }),
      tx.user.findUnique({ where: { id: session.userId } }),
      tx.membership.findUnique({
        where: {
          restaurantId_userId: {
            restaurantId: session.restaurantId,
            userId: session.userId,
          },
        },
      }),
    ]);
    const now = Date.now();
    if (
      !restaurant?.isActive ||
      !user?.isActive ||
      !membership?.isActive ||
      now - session.lastSeenAt.getTime() >= IDLE_LIMIT_MS ||
      now >= session.absoluteExpiresAt.getTime()
    ) {
      await tx.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      return null;
    }
    await tx.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(now) },
    });
    return {
      sessionId: session.id,
      restaurantId: session.restaurantId,
      userId: session.userId,
      role: membership.role,
      displayName: user.displayName,
      restaurantName: restaurant.name,
      restaurantCode: restaurant.publicCode,
    };
  });
}
