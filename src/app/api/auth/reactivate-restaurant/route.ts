import { createHash } from "node:crypto";
import { z } from "zod";
import { authPrisma } from "@/server/db/auth-prisma";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { allowReactivationAttempt } from "@/server/auth/rate-limit";
import { isSameOrigin, noStoreJson } from "@/server/api/security";

const schema = z.object({
  restaurantCode: z.string().trim().min(1).max(24),
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256),
});
const DUMMY_PASSWORD_HASH = `scrypt$16384$8$1$${Buffer.alloc(16).toString("base64url")}$${Buffer.alloc(64).toString("base64url")}`;

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return noStoreJson({ error: "Identifiants invalides." }, { status: 400 });
  const code = parsed.data.restaurantCode.toLowerCase();
  const email = parsed.data.email.toLowerCase();
  const limitKey = createHash("sha256")
    .update(`${code}\0${email}`)
    .digest("hex");
  if (!allowReactivationAttempt(limitKey)) {
    return noStoreJson(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429 },
    );
  }

  const credentials = await authPrisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.restaurant_code', ${code}, true)`;
    const restaurant = await tx.restaurant.findUnique({
      where: { publicCode: code },
    });
    if (!restaurant || restaurant.isActive) return null;
    await tx.$queryRaw`SELECT set_config('app.restaurant_id', ${restaurant.id}, true), set_config('app.email_normalized', ${email}, true)`;
    const credential = await tx.authCredential.findUnique({
      where: {
        restaurantId_emailNormalized: {
          restaurantId: restaurant.id,
          emailNormalized: email,
        },
      },
    });
    if (!credential) return null;
    await tx.$queryRaw`SELECT set_config('app.user_id', ${credential.userId}, true)`;
    const [user, membership] = await Promise.all([
      tx.user.findUnique({ where: { id: credential.userId } }),
      tx.membership.findUnique({
        where: {
          restaurantId_userId: {
            restaurantId: restaurant.id,
            userId: credential.userId,
          },
        },
      }),
    ]);
    if (!user?.isActive || !membership?.isActive || membership.role !== "OWNER")
      return null;
    return {
      restaurantId: restaurant.id,
      userId: user.id,
      passwordHash: credential.passwordHash,
    };
  });

  const passwordMatches = await verifyPassword(
    parsed.data.password,
    credentials?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!credentials || !passwordMatches) {
    return noStoreJson(
      { error: "Restaurant ou identifiants invalides." },
      { status: 401 },
    );
  }

  try {
    await authPrisma.$transaction(
      (tx) =>
        tx.$executeRaw`SELECT restoplus_private.reactivate_restaurant(${credentials.restaurantId}::uuid, ${credentials.userId}::uuid)`,
    );
    // The reactivation commit does not revive any prior session. Create a new session separately.
    const token = await createSession(
      credentials.restaurantId,
      credentials.userId,
    );
    await setSessionCookie(token);
    return noStoreJson({ reactivated: true });
  } catch {
    return noStoreJson(
      { error: "La réactivation a été refusée." },
      { status: 409 },
    );
  }
}
