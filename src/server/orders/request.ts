import { z } from "zod";

/**
 * The browser may submit product and option identifiers only. Product names,
 * stations, prices and currencies must be resolved by the server catalogue.
 */
const orderLineRequestSchema = z
  .object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(99),
    includedOptionIds: z.array(z.string().uuid()).max(1).optional(),
    paidOptionIds: z.array(z.string().uuid()).max(20).optional(),
    notes: z.string().max(255).optional(),
  })
  .strict();

export const createOrderRequestSchema = z
  .object({
    tableNumber: z.string().trim().min(1).max(30).optional(),
    coversCount: z.number().int().min(1).max(50).optional(),
    isTakeaway: z.boolean().optional(),
    notes: z.string().max(500).optional(),
    lines: z.array(orderLineRequestSchema).min(1).max(100),
  })
  .strict()
  .refine((input) => input.isTakeaway === true || Boolean(input.tableNumber), {
    message: "Une table est obligatoire pour une commande sur place.",
    path: ["tableNumber"],
  });
