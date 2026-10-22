import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthenticatedActor } from "@/server/auth/session";
import { withTenantTransaction } from "@/server/db/tenant-transaction";

export const diningTableSchema = z.object({
  tableNumber: z.string().trim().min(1).max(30),
  zone: z.enum(["STANDARD", "TERRACE", "VIP"]),
  capacity: z.coerce.number().int().min(1).max(500).default(4),
  isActive: z.coerce.boolean().default(true),
});

export type DiningTableInput = z.infer<typeof diningTableSchema>;

export type DiningTable = {
  id: string;
  tableNumber: string;
  zone: "STANDARD" | "TERRACE" | "VIP";
  capacity: number;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export class DiningTableError extends Error {
  readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_REFERENCE";

  constructor(
    code: "NOT_FOUND" | "CONFLICT" | "INVALID_REFERENCE",
    message: string,
  ) {
    super(message);
    this.name = "DiningTableError";
    this.code = code;
  }
}

function canManageTables(role: string) {
  return role === "OWNER" || role === "MANAGER";
}

export async function listDiningTables(actor: AuthenticatedActor) {
  return withTenantTransaction(actor, async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        tableNumber: string;
        zone: string;
        capacity: number;
        status: string;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
      }>
    >`
      SELECT "id", "tableNumber", "zone", "capacity", "status", "isActive",
             "createdAt"::text AS "createdAt", "updatedAt"::text AS "updatedAt"
      FROM public.dining_tables
      WHERE "restaurantId" = ${actor.restaurantId}::uuid
      ORDER BY "tableNumber" ASC, "id" ASC
    `;
    return rows.map((row) => ({
      ...row,
      zone: row.zone as "STANDARD" | "TERRACE" | "VIP",
      capacity: Number(row.capacity),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  });
}

export async function createDiningTable(
  actor: AuthenticatedActor,
  input: DiningTableInput,
) {
  if (!canManageTables(actor.role))
    throw new Error("Action non autorisée pour ce rôle.");
  const parsed = diningTableSchema.parse(input);
  const id = randomUUID();
  await withTenantTransaction(actor, async (tx) => {
    try {
      await tx.$executeRaw`
        INSERT INTO public.dining_tables
          ("id", "restaurantId", "tableNumber", "zone", "capacity", "status", "isActive", "updatedAt")
        VALUES (${id}::uuid, ${actor.restaurantId}::uuid, ${parsed.tableNumber},
          ${parsed.zone}::public.menu_zone, ${parsed.capacity}, 'FREE',
          ${parsed.isActive}, now())
      `;
    } catch {
      throw new DiningTableError(
        "CONFLICT",
        "Ce numéro de table existe déjà dans ce restaurant.",
      );
    }
  });
  return { id };
}

export async function updateDiningTable(
  actor: AuthenticatedActor,
  tableId: string,
  input: Partial<DiningTableInput>,
) {
  if (!canManageTables(actor.role))
    throw new Error("Action non autorisée pour ce rôle.");
  const parsed = diningTableSchema.partial().parse(input);
  const result = await withTenantTransaction(actor, async (tx) => {
    const current = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM public.dining_tables
      WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "id" = ${tableId}::uuid
      FOR UPDATE
    `;
    if (!current[0])
      throw new DiningTableError("NOT_FOUND", "Table introuvable.");
    if (parsed.tableNumber !== undefined || parsed.zone !== undefined) {
      const conflict = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM public.dining_tables
        WHERE "restaurantId" = ${actor.restaurantId}::uuid
          AND "tableNumber" = ${parsed.tableNumber ?? current[0].id}::text
          AND "id" <> ${tableId}::uuid
      `;
      if (conflict[0])
        throw new DiningTableError(
          "CONFLICT",
          "Ce numéro de table existe déjà dans ce restaurant.",
        );
    }
    await tx.$executeRaw`
      UPDATE public.dining_tables SET
        "tableNumber" = CASE WHEN ${parsed.tableNumber !== undefined} THEN ${parsed.tableNumber ?? null} ELSE "tableNumber" END,
        "zone" = CASE WHEN ${parsed.zone !== undefined} THEN ${parsed.zone ?? null}::public.menu_zone ELSE "zone" END,
        "capacity" = CASE WHEN ${parsed.capacity !== undefined} THEN ${parsed.capacity ?? null} ELSE "capacity" END,
        "isActive" = CASE WHEN ${parsed.isActive !== undefined} THEN ${parsed.isActive ?? null} ELSE "isActive" END,
        "updatedAt" = now()
      WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "id" = ${tableId}::uuid
    `;
    return { id: tableId };
  });
  return result;
}

export async function deactivateDiningTable(
  actor: AuthenticatedActor,
  tableId: string,
) {
  if (!canManageTables(actor.role))
    throw new Error("Action non autorisée pour ce rôle.");
  const result = await withTenantTransaction(actor, async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE public.dining_tables SET "isActive" = false, "updatedAt" = now()
      WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "id" = ${tableId}::uuid AND "isActive"
    `;
    if (updated === 0)
      throw new DiningTableError("NOT_FOUND", "Table active introuvable.");
    return { id: tableId, deactivated: true };
  });
  return result;
}