import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedActor } from "@/server/auth/session";
import { withTenantTransaction } from "@/server/db/tenant-transaction";
import { canManageCatalog } from "./authorization";
import { resolveCatalogBasePrice } from "./pricing";
import type {
  CreateProductInput,
  UpdateProductInput,
  ZonePriceInput,
} from "./request";

type Tx = Prisma.TransactionClient;
type Zone = "TERRACE" | "VIP";

export class CatalogError extends Error {
  readonly code: "NOT_FOUND" | "INVALID_REFERENCE" | "CONFLICT";

  constructor(
    code: "NOT_FOUND" | "INVALID_REFERENCE" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "CatalogError";
    this.code = code;
  }
}

function requireManager(actor: AuthenticatedActor) {
  if (!canManageCatalog(actor.role))
    throw new Error("Action non autorisée pour ce rôle.");
}

export async function listMenuCatalog(actor: AuthenticatedActor) {
  return withTenantTransaction(actor, async (tx) => {
    const manager = canManageCatalog(actor.role);
    const categories = await tx.$queryRaw<
      Array<{
        id: string;
        name: string;
        displayOrder: number;
        isActive: boolean;
      }>
    >`
      SELECT "id", "name", "displayOrder", "isActive"
      FROM public.menu_categories
      WHERE "restaurantId" = ${actor.restaurantId}::uuid
        AND (${manager}::boolean OR "isActive" = true)
      ORDER BY "displayOrder", "name", "id"
    `;
    const categoryItems = categories.map((category) => ({
      id: category.id,
      name: category.name,
      displayOrder: category.displayOrder,
      active: category.isActive,
    }));
    const products = await tx.$queryRaw<
      Array<{
        id: string;
        categoryId: string;
        category: string;
        name: string;
        description: string | null;
        preparationStation: "CUISINE" | "BAR";
        currency: "CDF" | "USD";
        standardPriceAmount: string;
        isAvailable: boolean;
        isDailySpecial: boolean;
        isActive: boolean;
        displayOrder: number;
      }>
    >`
      SELECT p."id", p."categoryId", c."name" AS "category", p."name",
             p."description", p."preparationStation", p."currency",
             p."standardPriceAmount"::text AS "standardPriceAmount",
             p."isAvailable", p."isDailySpecial", p."isActive", p."displayOrder"
      FROM public.menu_products AS p
      JOIN public.menu_categories AS c
        ON c."restaurantId" = p."restaurantId" AND c."id" = p."categoryId"
      WHERE p."restaurantId" = ${actor.restaurantId}::uuid
        AND (${manager}::boolean OR (p."isActive" AND c."isActive"))
      ORDER BY c."displayOrder", p."displayOrder", p."name", p."id"
    `;

    const productIds = products.map((product) => product.id);
    const permissions = {
      manage: manager,
      changeAvailability:
        actor.role === "OWNER" ||
        actor.role === "MANAGER" ||
        actor.role === "KITCHEN",
    };
    if (productIds.length === 0)
      return { categories: categoryItems, products: [], permissions };

    const variants = await tx.$queryRaw<
      Array<{
        id: string;
        productId: string;
        name: string;
        standardPriceAmount: string;
        isAvailable: boolean;
        isActive: boolean;
        displayOrder: number;
      }>
    >`
      SELECT "id", "productId", "name", "standardPriceAmount"::text AS "standardPriceAmount",
             "isAvailable", "isActive", "displayOrder"
      FROM public.menu_product_variants
      WHERE "restaurantId" = ${actor.restaurantId}::uuid
        AND "productId" = ANY(${productIds}::uuid[])
        AND (${manager}::boolean OR ("isActive" AND "isAvailable"))
      ORDER BY "displayOrder", "name", "id"
    `;
    const options = await tx.$queryRaw<
      Array<{
        id: string;
        productId: string;
        name: string;
        kind: "INCLUDED" | "PAID";
        priceAmount: string;
        currency: "CDF" | "USD";
        isAvailable: boolean;
        isActive: boolean;
        displayOrder: number;
      }>
    >`
      SELECT "id", "productId", "name", "kind", "priceAmount"::text AS "priceAmount",
             "currency", "isAvailable", "isActive", "displayOrder"
      FROM public.menu_product_options
      WHERE "restaurantId" = ${actor.restaurantId}::uuid
        AND "productId" = ANY(${productIds}::uuid[])
        AND (${manager}::boolean OR ("isActive" AND "isAvailable"))
      ORDER BY "displayOrder", "name", "id"
    `;
    const zonePrices = await tx.$queryRaw<
      Array<{
        id: string;
        productId: string;
        variantId: string | null;
        zone: Zone;
        priceAmount: string;
        isActive: boolean;
      }>
    >`
      SELECT "id", "productId", "variantId", "zone", "priceAmount"::text AS "priceAmount", "isActive"
      FROM public.menu_product_zone_prices
      WHERE "restaurantId" = ${actor.restaurantId}::uuid
        AND "productId" = ANY(${productIds}::uuid[])
        AND (${manager}::boolean OR "isActive")
      ORDER BY "zone", "id"
    `;

    const productsWithDetails = products.map((product) => {
      const productPrices = zonePrices.filter(
        (price) => price.productId === product.id,
      );
      const variantsForProduct = variants.filter(
        (variant) => variant.productId === product.id,
      );
      const optionsForProduct = options.filter(
        (option) => option.productId === product.id,
      );
      const productZonePrices = productPrices.filter(
        (price) => price.variantId === null,
      );
      const mapZonePrices = (rows: typeof zonePrices) =>
        Object.fromEntries(
          rows
            .filter((row) => row.isActive)
            .map((row) => [row.zone, row.priceAmount]),
        ) as Partial<Record<Zone, string>>;

      const productZones = mapZonePrices(productZonePrices);
      const productOptions = optionsForProduct.map((option) => ({
        id: option.id,
        name: option.name,
        kind: option.kind,
        priceAmount: option.priceAmount,
        currency: option.currency,
        available: option.isAvailable,
        active: option.isActive,
        displayOrder: option.displayOrder,
      }));
      return {
        id: product.id,
        categoryId: product.categoryId,
        category: product.category,
        name: product.name,
        description: product.description,
        preparationStation: product.preparationStation,
        price: {
          amount: product.standardPriceAmount,
          currency: product.currency,
        },
        zonePrices: {
          ...(productZones.TERRACE
            ? {
                terrace: {
                  amount: productZones.TERRACE,
                  currency: product.currency,
                },
              }
            : {}),
          ...(productZones.VIP
            ? { vip: { amount: productZones.VIP, currency: product.currency } }
            : {}),
        },
        available: product.isAvailable,
        dailyMenu: product.isDailySpecial,
        active: product.isActive,
        displayOrder: product.displayOrder,
        photoLabel: product.name.slice(0, 2).toUpperCase(),
        variants: variantsForProduct.map((variant) => ({
          id: variant.id,
          name: variant.name,
          standardPriceAmount: variant.standardPriceAmount,
          zonePrices: mapZonePrices(
            productPrices.filter((price) => price.variantId === variant.id),
          ),
          available: variant.isAvailable,
          active: variant.isActive,
          displayOrder: variant.displayOrder,
        })),
        requiredAccompaniments: productOptions.filter(
          (option) => option.kind === "INCLUDED",
        ),
        paidExtras: productOptions.filter((option) => option.kind === "PAID"),
      };
    });
    return {
      categories: categoryItems,
      products: productsWithDetails,
      permissions,
    };
  });
}

export async function createMenuCategory(
  actor: AuthenticatedActor,
  input: { name: string; displayOrder?: number },
) {
  requireManager(actor);
  const id = randomUUID();
  await withTenantTransaction(actor, async (tx) => {
    await tx.$executeRaw`
      INSERT INTO public.menu_categories ("id", "restaurantId", "name", "displayOrder", "updatedAt")
      VALUES (${id}::uuid, ${actor.restaurantId}::uuid, ${input.name}, ${input.displayOrder ?? 0}, now())
    `;
  });
  return { id };
}

export async function updateMenuCategory(
  actor: AuthenticatedActor,
  categoryId: string,
  input: {
    name?: string;
    displayOrder?: number;
    isActive?: boolean;
  },
) {
  requireManager(actor);
  const result = await withTenantTransaction(
    actor,
    (tx) => tx.$executeRaw`
    UPDATE public.menu_categories SET
      "name" = CASE WHEN ${input.name !== undefined} THEN ${input.name ?? null} ELSE "name" END,
      "displayOrder" = CASE WHEN ${input.displayOrder !== undefined} THEN ${input.displayOrder ?? null} ELSE "displayOrder" END,
      "isActive" = CASE WHEN ${input.isActive !== undefined} THEN ${input.isActive ?? null} ELSE "isActive" END,
      "updatedAt" = now()
    WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "id" = ${categoryId}::uuid
  `,
  );
  if (result === 0)
    throw new CatalogError("NOT_FOUND", "Catégorie introuvable.");
  return { id: categoryId };
}

async function assertActiveCategory(
  tx: Tx,
  restaurantId: string,
  categoryId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM public.menu_categories
    WHERE "restaurantId" = ${restaurantId}::uuid AND "id" = ${categoryId}::uuid AND "isActive"
    FOR SHARE
  `;
  if (!rows[0])
    throw new CatalogError(
      "INVALID_REFERENCE",
      "La catégorie est absente ou inactive.",
    );
}

async function saveZonePrices(
  tx: Tx,
  restaurantId: string,
  productId: string,
  variantId: string | null,
  prices: ZonePriceInput[],
) {
  await tx.$executeRaw`
    UPDATE public.menu_product_zone_prices SET "isActive" = false, "updatedAt" = now()
    WHERE "restaurantId" = ${restaurantId}::uuid AND "productId" = ${productId}::uuid
      AND "variantId" IS NOT DISTINCT FROM ${variantId}::uuid
  `;
  for (const price of prices) {
    const old = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM public.menu_product_zone_prices
      WHERE "restaurantId" = ${restaurantId}::uuid AND "productId" = ${productId}::uuid
        AND "variantId" IS NOT DISTINCT FROM ${variantId}::uuid
        AND "zone" = ${price.zone}::public.menu_zone
      FOR UPDATE
    `;
    if (old[0]) {
      await tx.$executeRaw`
        UPDATE public.menu_product_zone_prices
        SET "priceAmount" = ${price.priceAmount}::numeric, "isActive" = true, "updatedAt" = now()
        WHERE "restaurantId" = ${restaurantId}::uuid AND "id" = ${old[0].id}::uuid
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO public.menu_product_zone_prices
          ("id", "restaurantId", "productId", "variantId", "zone", "priceAmount", "updatedAt")
        VALUES (${randomUUID()}::uuid, ${restaurantId}::uuid, ${productId}::uuid,
          ${variantId}::uuid, ${price.zone}::public.menu_zone, ${price.priceAmount}::numeric, now())
      `;
    }
  }
}

async function replaceVariants(
  tx: Tx,
  restaurantId: string,
  productId: string,
  variants: CreateProductInput["variants"],
) {
  await tx.$executeRaw`
    UPDATE public.menu_product_zone_prices SET "isActive" = false, "updatedAt" = now()
    WHERE "restaurantId" = ${restaurantId}::uuid AND "productId" = ${productId}::uuid AND "variantId" IS NOT NULL
  `;
  await tx.$executeRaw`
    UPDATE public.menu_product_variants SET "isActive" = false, "isAvailable" = false, "updatedAt" = now()
    WHERE "restaurantId" = ${restaurantId}::uuid AND "productId" = ${productId}::uuid
  `;
  for (const [index, variant] of (variants ?? []).entries()) {
    const id = randomUUID();
    await tx.$executeRaw`
      INSERT INTO public.menu_product_variants
        ("id", "restaurantId", "productId", "name", "standardPriceAmount", "isAvailable", "displayOrder", "updatedAt")
      VALUES (${id}::uuid, ${restaurantId}::uuid, ${productId}::uuid, ${variant.name},
        ${variant.standardPriceAmount}::numeric, ${variant.isAvailable ?? true}, ${variant.displayOrder ?? index}, now())
    `;
    await saveZonePrices(
      tx,
      restaurantId,
      productId,
      id,
      variant.zonePrices ?? [],
    );
  }
}

async function replaceOptions(
  tx: Tx,
  restaurantId: string,
  productId: string,
  options: CreateProductInput["options"],
  currency: string,
) {
  await tx.$executeRaw`
    UPDATE public.menu_product_options SET "isActive" = false, "isAvailable" = false, "updatedAt" = now()
    WHERE "restaurantId" = ${restaurantId}::uuid AND "productId" = ${productId}::uuid
  `;
  for (const [index, option] of (options ?? []).entries()) {
    await tx.$executeRaw`
      INSERT INTO public.menu_product_options
        ("id", "restaurantId", "productId", "name", "kind", "priceAmount", "currency", "isAvailable", "displayOrder", "updatedAt")
      VALUES (${randomUUID()}::uuid, ${restaurantId}::uuid, ${productId}::uuid, ${option.name},
        ${option.kind}::public.menu_product_option_kind, ${option.priceAmount}::numeric,
        ${currency}, ${option.isAvailable ?? true}, ${option.displayOrder ?? index}, now())
    `;
  }
}

export async function createMenuProduct(
  actor: AuthenticatedActor,
  input: CreateProductInput,
) {
  requireManager(actor);
  const id = randomUUID();
  await withTenantTransaction(actor, async (tx) => {
    await assertActiveCategory(tx, actor.restaurantId, input.categoryId);
    await tx.$executeRaw`
      INSERT INTO public.menu_products
        ("id", "restaurantId", "categoryId", "name", "description", "preparationStation", "currency",
         "standardPriceAmount", "isAvailable", "isDailySpecial", "displayOrder", "updatedAt")
      VALUES (${id}::uuid, ${actor.restaurantId}::uuid, ${input.categoryId}::uuid, ${input.name},
        ${input.description ?? null}, ${input.preparationStation}::public.menu_preparation_station,
        ${input.currency}, ${input.standardPriceAmount}::numeric, ${input.isAvailable ?? true},
        ${input.isDailySpecial ?? false}, ${input.displayOrder ?? 0}, now())
    `;
    await saveZonePrices(
      tx,
      actor.restaurantId,
      id,
      null,
      input.zonePrices ?? [],
    );
    await replaceVariants(tx, actor.restaurantId, id, input.variants);
    await replaceOptions(
      tx,
      actor.restaurantId,
      id,
      input.options,
      input.currency,
    );
  });
  return { id };
}

export async function updateMenuProduct(
  actor: AuthenticatedActor,
  productId: string,
  input: UpdateProductInput,
) {
  requireManager(actor);
  await withTenantTransaction(actor, async (tx) => {
    const current = await tx.$queryRaw<Array<{ id: string; currency: string }>>`
      SELECT "id", "currency" FROM public.menu_products
      WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "id" = ${productId}::uuid
      FOR UPDATE
    `;
    if (!current[0])
      throw new CatalogError("NOT_FOUND", "Article introuvable.");
    if (
      input.currency &&
      input.currency !== current[0].currency &&
      (!input.zonePrices || !input.variants || !input.options)
    ) {
      throw new CatalogError(
        "INVALID_REFERENCE",
        "Un changement de devise exige la confirmation de tous les tarifs, variantes et options dans la même opération.",
      );
    }
    if (input.categoryId)
      await assertActiveCategory(tx, actor.restaurantId, input.categoryId);
    await tx.$executeRaw`
      UPDATE public.menu_products SET
        "categoryId" = CASE WHEN ${input.categoryId !== undefined} THEN ${input.categoryId ?? null}::uuid ELSE "categoryId" END,
        "name" = CASE WHEN ${input.name !== undefined} THEN ${input.name ?? null} ELSE "name" END,
        "description" = CASE WHEN ${input.description !== undefined} THEN ${input.description ?? null} ELSE "description" END,
        "preparationStation" = CASE WHEN ${input.preparationStation !== undefined} THEN ${input.preparationStation ?? null}::public.menu_preparation_station ELSE "preparationStation" END,
        "currency" = CASE WHEN ${input.currency !== undefined} THEN ${input.currency ?? null} ELSE "currency" END,
        "standardPriceAmount" = CASE WHEN ${input.standardPriceAmount !== undefined} THEN ${input.standardPriceAmount ?? null}::numeric ELSE "standardPriceAmount" END,
        "isDailySpecial" = CASE WHEN ${input.isDailySpecial !== undefined} THEN ${input.isDailySpecial ?? null} ELSE "isDailySpecial" END,
        "displayOrder" = CASE WHEN ${input.displayOrder !== undefined} THEN ${input.displayOrder ?? null} ELSE "displayOrder" END,
        "isActive" = CASE WHEN ${input.isActive !== undefined} THEN ${input.isActive ?? null} ELSE "isActive" END,
        "isAvailable" = CASE WHEN ${input.isActive === false} THEN false
          WHEN ${input.isAvailable !== undefined} THEN ${input.isAvailable ?? null} ELSE "isAvailable" END,
        "updatedAt" = now()
      WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "id" = ${productId}::uuid
    `;
    if (input.zonePrices)
      await saveZonePrices(
        tx,
        actor.restaurantId,
        productId,
        null,
        input.zonePrices,
      );
    if (input.variants)
      await replaceVariants(tx, actor.restaurantId, productId, input.variants);
    if (input.options)
      await replaceOptions(
        tx,
        actor.restaurantId,
        productId,
        input.options,
        input.currency ?? current[0].currency,
      );
  });
  return { id: productId };
}

export async function setMenuProductAvailability(
  actor: AuthenticatedActor,
  productId: string,
  isAvailable: boolean,
) {
  if (
    actor.role !== "OWNER" &&
    actor.role !== "MANAGER" &&
    actor.role !== "KITCHEN"
  ) {
    throw new Error("Action non autorisée pour ce rôle.");
  }
  const result = await withTenantTransaction(
    actor,
    (tx) => tx.$executeRaw`
    UPDATE public.menu_products SET "isAvailable" = ${isAvailable}, "updatedAt" = now()
    WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "id" = ${productId}::uuid AND "isActive"
  `,
  );
  if (result === 0)
    throw new CatalogError("NOT_FOUND", "Article actif introuvable.");
  return { id: productId, isAvailable };
}

export async function deactivateMenuProduct(
  actor: AuthenticatedActor,
  productId: string,
) {
  requireManager(actor);
  const result = await withTenantTransaction(
    actor,
    (tx) => tx.$executeRaw`
    UPDATE public.menu_products SET "isActive" = false, "isAvailable" = false, "updatedAt" = now()
    WHERE "restaurantId" = ${actor.restaurantId}::uuid AND "id" = ${productId}::uuid AND "isActive"
  `,
  );
  if (result === 0)
    throw new CatalogError("NOT_FOUND", "Article actif introuvable.");
  return { id: productId, deactivated: true };
}

export async function resolveAndSnapshotOrderLine(
  tx: Tx,
  restaurantId: string,
  line: {
    productId: string;
    quantity: number;
    variantId?: string;
    includedOptionIds?: string[];
    paidOptionIds?: string[];
    notes?: string;
  },
  zone: "STANDARD" | "TERRACE" | "VIP",
) {
  const productRows = await tx.$queryRaw<
    Array<{
      id: string;
      categoryId: string;
      name: string;
      preparationStation: "CUISINE" | "BAR";
      currency: "CDF" | "USD";
      standardPriceAmount: string;
      isAvailable: boolean;
      isActive: boolean;
      categoryActive: boolean;
    }>
  >`
    SELECT p."id", p."categoryId", p."name", p."preparationStation", p."currency",
           p."standardPriceAmount"::text AS "standardPriceAmount", p."isAvailable", p."isActive",
           c."isActive" AS "categoryActive"
    FROM public.menu_products AS p
    JOIN public.menu_categories AS c
      ON c."restaurantId" = p."restaurantId" AND c."id" = p."categoryId"
    WHERE p."restaurantId" = ${restaurantId}::uuid AND p."id" = ${line.productId}::uuid
    FOR SHARE OF p, c
  `;
  const product = productRows[0];
  if (
    !product ||
    !product.isActive ||
    !product.isAvailable ||
    !product.categoryActive
  ) {
    throw new CatalogError(
      "INVALID_REFERENCE",
      "Article absent, inactif ou indisponible.",
    );
  }

  let variant:
    { id: string; name: string; standardPriceAmount: string } | undefined;
  if (line.variantId) {
    const variants = await tx.$queryRaw<
      Array<{ id: string; name: string; standardPriceAmount: string }>
    >`
      SELECT "id", "name", "standardPriceAmount"::text AS "standardPriceAmount"
      FROM public.menu_product_variants
      WHERE "restaurantId" = ${restaurantId}::uuid AND "productId" = ${product.id}::uuid
        AND "id" = ${line.variantId}::uuid AND "isActive" AND "isAvailable"
      FOR SHARE
    `;
    variant = variants[0];
    if (!variant)
      throw new CatalogError(
        "INVALID_REFERENCE",
        "Variante absente ou indisponible pour cet article.",
      );
  }

  let productTerrace: string | undefined;
  let productVip: string | undefined;
  let variantTerrace: string | undefined;
  let variantVip: string | undefined;
  if (zone !== "STANDARD") {
    const productZone = await tx.$queryRaw<
      Array<{ zone: Zone; priceAmount: string }>
    >`
      SELECT "zone", "priceAmount"::text AS "priceAmount" FROM public.menu_product_zone_prices
      WHERE "restaurantId" = ${restaurantId}::uuid AND "productId" = ${product.id}::uuid
        AND "variantId" IS NULL AND "zone" IN ('TERRACE'::public.menu_zone, 'VIP'::public.menu_zone) AND "isActive"
      FOR SHARE
    `;
    for (const row of productZone) {
      if (row.zone === "TERRACE") productTerrace = row.priceAmount;
      if (row.zone === "VIP") productVip = row.priceAmount;
    }
    if (variant) {
      const variantZones = await tx.$queryRaw<
        Array<{ zone: Zone; priceAmount: string }>
      >`
        SELECT "zone", "priceAmount"::text AS "priceAmount" FROM public.menu_product_zone_prices
        WHERE "restaurantId" = ${restaurantId}::uuid AND "productId" = ${product.id}::uuid
          AND "variantId" = ${variant.id}::uuid
          AND "zone" IN ('TERRACE'::public.menu_zone, 'VIP'::public.menu_zone) AND "isActive"
        FOR SHARE
      `;
      for (const row of variantZones) {
        if (row.zone === "TERRACE") variantTerrace = row.priceAmount;
        if (row.zone === "VIP") variantVip = row.priceAmount;
      }
    }
  }
  const baseAmount = resolveCatalogBasePrice({
    zone,
    productStandard: product.standardPriceAmount,
    productTerrace,
    productVip,
    variantStandard: variant?.standardPriceAmount,
    variantTerrace,
    variantVip,
  });

  const includedIds = line.includedOptionIds ?? [];
  const paidIds = line.paidOptionIds ?? [];
  if (includedIds.length > 1)
    throw new CatalogError(
      "INVALID_REFERENCE",
      "Un seul accompagnement inclus peut être choisi par ligne.",
    );
  if (
    new Set([...includedIds, ...paidIds]).size !==
    includedIds.length + paidIds.length
  ) {
    throw new CatalogError(
      "INVALID_REFERENCE",
      "Une option ne peut pas être sélectionnée plusieurs fois.",
    );
  }
  toMinorUnits(baseAmount);
  const optionSnapshots: Array<{
    id: string;
    name: string;
    kind: string;
    amount: string;
    currency: string;
  }> = [];
  for (const [ids, kind] of [
    [includedIds, "INCLUDED"],
    [paidIds, "PAID"],
  ] as const) {
    for (const optionId of ids) {
      const options = await tx.$queryRaw<
        Array<{
          id: string;
          name: string;
          kind: "INCLUDED" | "PAID";
          priceAmount: string;
          currency: "CDF" | "USD";
          isAvailable: boolean;
        }>
      >`
        SELECT "id", "name", "kind", "priceAmount"::text AS "priceAmount", "currency", "isAvailable"
        FROM public.menu_product_options
        WHERE "restaurantId" = ${restaurantId}::uuid AND "productId" = ${product.id}::uuid
          AND "id" = ${optionId}::uuid AND "isActive" AND "isAvailable"
        FOR SHARE
      `;
      const option = options[0];
      if (
        !option ||
        option.kind !== kind ||
        option.currency !== product.currency
      ) {
        throw new CatalogError(
          "INVALID_REFERENCE",
          "Option absente, indisponible ou incompatible avec l'article.",
        );
      }
      const amountMinor = toMinorUnits(option.priceAmount);
      if (kind === "INCLUDED" && amountMinor !== BigInt(0))
        throw new CatalogError(
          "INVALID_REFERENCE",
          "L'accompagnement inclus doit être gratuit.",
        );
      if (kind === "PAID" && amountMinor <= BigInt(0))
        throw new CatalogError(
          "INVALID_REFERENCE",
          "Le supplément doit avoir un prix positif.",
        );
      optionSnapshots.push({
        id: option.id,
        name: option.name,
        kind: option.kind,
        amount: option.priceAmount,
        currency: option.currency,
      });
    }
  }
  return {
    productId: product.id,
    productName: variant ? `${product.name} — ${variant.name}` : product.name,
    station: product.preparationStation,
    quantity: line.quantity,
    unitPriceAmount: baseAmount,
    currency: product.currency,
    selectedAccompaniments: optionSnapshots.filter(
      (option) => option.kind === "INCLUDED",
    ),
    selectedExtras: optionSnapshots.filter((option) => option.kind === "PAID"),
    notes: line.notes?.trim() || null,
  };
}

function toMinorUnits(value: string): bigint {
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}
