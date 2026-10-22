import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForAuthPrisma = globalThis as unknown as {
  authPrisma?: PrismaClient;
};

export function getAuthPrisma(): PrismaClient {
  const connectionString = process.env.AUTH_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "AUTH_DATABASE_URL must be configured for auth operations.",
    );
  }

  if (!globalForAuthPrisma.authPrisma) {
    const adapter = new PrismaPg({ connectionString });
    globalForAuthPrisma.authPrisma = new PrismaClient({ adapter });
  }

  return globalForAuthPrisma.authPrisma;
}

export const authPrisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getAuthPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
