import { z } from "zod";

const id = z.string().uuid();
const name = z.string().trim().min(1).max(160);
const amount = z
  .string()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Montant décimal invalide.");
const currency = z.enum(["CDF", "USD"]);
const zonePrice = z
  .object({
    zone: z.enum(["TERRACE", "VIP"]),
    priceAmount: amount,
  })
  .strict();
const zonePrices = z
  .array(zonePrice)
  .max(2)
  .refine(
    (prices) =>
      new Set(prices.map((price) => price.zone)).size === prices.length,
    "Une seule ligne tarifaire est autorisée par zone.",
  );

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    displayOrder: z.number().int().min(0).max(100000).optional(),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    displayOrder: z.number().int().min(0).max(100000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Aucune modification fournie.",
  );

const variantSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    standardPriceAmount: amount,
    isAvailable: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(100000).optional(),
    zonePrices: zonePrices.optional(),
  })
  .strict();

const optionSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    kind: z.enum(["INCLUDED", "PAID"]),
    priceAmount: amount,
    isAvailable: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(100000).optional(),
  })
  .strict()
  .refine((option) => {
    const [whole = "0", fraction = ""] = option.priceAmount.split(".");
    const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
    return option.kind === "INCLUDED" ? cents === BigInt(0) : cents > BigInt(0);
  }, "Un accompagnement inclus doit valoir zéro; un supplément doit être positif.");

export const createProductSchema = z
  .object({
    categoryId: id,
    name,
    description: z.string().trim().max(1000).nullable().optional(),
    preparationStation: z.enum(["CUISINE", "BAR"]),
    currency,
    standardPriceAmount: amount,
    isAvailable: z.boolean().optional(),
    isDailySpecial: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(100000).optional(),
    zonePrices: zonePrices.optional(),
    variants: z.array(variantSchema).max(50).optional(),
    options: z.array(optionSchema).max(100).optional(),
  })
  .strict();

export const updateProductSchema = z
  .object({
    categoryId: id.optional(),
    name: name.optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    preparationStation: z.enum(["CUISINE", "BAR"]).optional(),
    currency: currency.optional(),
    standardPriceAmount: amount.optional(),
    isAvailable: z.boolean().optional(),
    isDailySpecial: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(100000).optional(),
    isActive: z.boolean().optional(),
    zonePrices: zonePrices.optional(),
    variants: z.array(variantSchema).max(50).optional(),
    options: z.array(optionSchema).max(100).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Aucune modification fournie.",
  );

export const productAvailabilitySchema = z
  .object({
    isAvailable: z.boolean(),
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ZonePriceInput = z.infer<typeof zonePrice>;
