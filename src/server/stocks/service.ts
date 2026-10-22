import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthenticatedActor } from "@/server/auth/session";
import { withTenantTransaction } from "@/server/db/tenant-transaction";

export const stockItemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  unit: z.string().trim().max(30).default("unité"),
  quantity: z.coerce.number().min(0).default(0),
  threshold: z.coerce.number().min(0).default(0),
  currency: z.enum(["CDF", "USD"]).default("CDF"),
  isActive: z.coerce.boolean().default(true),
});

export type StockItemInput = z.infer<typeof stockItemSchema>;

export type StockItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  threshold: number;
  currency: "CDF" | "USD";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export class StockError extends Error {
  readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_REFERENCE";

  constructor(
    code: "NOT_FOUND" | "CONFLICT" | "INVALID_REFERENCE",
    message: string,
  ) {
    super(message);
    this.name = "StockError";
    this.code = code;
  }
}

function canManageStock(role: string) {
  return role === "OWNER" || role === "MANAGER" || role === "STOCK_MANAGER";
}

export async function listStockItems(actor: AuthenticatedActor) {
  return withTenantTransaction(actor, async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        name: string;
        unit: string;
        quantity: string;
        threshold: string;
        currency: string;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
      }>
    >`
      SELECT "id", "name", "unit", "quantity"::text AS "quantity",
             "threshold"::text AS "threshold", "currency", "isActive",
             "createdAt"::text AS "createdAt", "updatedAt"::text AS "updatedAt"
      FROM public.stock_items
      WHERE "restaurantId" = ${actor.restaurantId}::uuid
      ORDER BY "name" ASC, "id" ASC
    `;
    return rows.map((row) => ({
      ...row,
      currency: row.currency as "CDF" | "USD",
      quantity: Number(row.quantity),
      threshold: Number(row.threshold),
    }));
  });
}

export async function createStockItem(actor: AuthenticatedActor, input: StockItemInput) {
  if (!canManageStock(actor.role))
    throw new Error("Action non autorisée pour ce rôle.");
  const parsed = stockItemSchema.parse(input);
  const id = randomUUID();
  await withTenantTransaction(actor, async (tx) => {
    try {
      await tx.$executeRaw`
        INSERT INTO public.stock_items
          ("id", "restaurantId", "name", "unit", "quantity", "threshold", "currency", "isActive", "updatedAt")
        VALUES (${id}::uuid, ${actor.restaurantId}::uuid, ${parsed.name}, ${parsed.unit},
          ${parsed.quantity}::numeric, ${parsed.threshold}::numeric, ${parsed.currency},
          ${parsed.isActive}, now())
      `;
    } catch {
      throw new StockError("CONFLICT", "Cet article de stock existe déjà.");
    }
  });
  return { id };
}

export async function updateStockItem(
  actor: AuthenticatedActor,
  stockId: string,
  input: Partial<StockItemInput>,
) {
  if (!canManageStock(actor.role))
    throw new Error("Action non autorisée pour ce rôle.");
  const parsed = stockItemSchema.partial().parse(input);
  await withTenantTransaction(actor, async (tx) => {
    const current = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM public.stock_items
      WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "id" = ${stockId}::uuid
      FOR UPDATE
    `;
    if (!current[0])
      throw new StockError("NOT_FOUND", "Article de stock introuvable.");
    if (parsed.name !== undefined) {
      const conflict = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM public.stock_items
        WHERE "restaurantId" = ${actor.restaurantId}::uuid
          AND "name" = ${parsed.name} AND "id" <> ${stockId}::uuid
      `;
      if (conflict[0])
        throw new StockError("CONFLICT", "Ce nom d'article existe déjà.");
    }
    await tx.$executeRaw`
      UPDATE public.stock_items SET
        "name" = CASE WHEN ${parsed.name !== undefined} THEN ${parsed.name ?? null} ELSE "name" END,
        "unit" = CASE WHEN ${parsed.unit !== undefined} THEN ${parsed.unit ?? null} ELSE "unit" END,
        "quantity" = CASE WHEN ${parsed.quantity !== undefined} THEN ${parsed.quantity ?? null}::numeric ELSE "quantity" END,
        "threshold" = CASE WHEN ${parsed.threshold !== undefined} THEN ${parsed.threshold ?? null}::numeric ELSE "threshold" END,
        "currency" = CASE WHEN ${parsed.currency !== undefined} THEN ${parsed.currency ?? null} ELSE "currency" END,
        "isActive" = CASE WHEN ${parsed.isActive !== undefined} THEN ${parsed.isActive ?? null} ELSE "isActive" END,
        "updatedAt" = now()
      WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "id" = ${stockId}::uuid
    `;
  });
  return { id: stockId };
}

export async function deactivateStockItem(actor: AuthenticatedActor, stockId: string) {
  if (!canManageStock(actor.role))
    throw new Error("Action non autorisée pour ce rôle.");
  const result = await withTenantTransaction(actor, async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE public.stock_items SET "isActive" = false, "updatedAt" = now()
      WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "id" = ${stockId}::uuid AND "isActive"
    `;
    if (updated === 0)
      throw new StockError("NOT_FOUND", "Article de stock actif introuvable.");
    return { id: stockId, deactivated: true };
  });
  return result;
}