import { z } from "zod";
import { isSameOrigin, noStoreJson } from "@/server/api/security";
import { getAuthenticatedActor } from "@/server/auth/session";
import {
  OrderPrerequisiteError,
  settleOrderPaymentService,
} from "@/server/orders/service";

const paymentItemSchema = z
  .object({
    method: z.enum([
      "CASH_CDF",
      "CASH_USD",
      "MPESA",
      "ORANGE_MONEY",
      "AIRTEL_MONEY",
      "CARD",
    ]),
    amountPaid: z.number().positive(),
    currencyPaid: z.enum(["CDF", "USD"]),
    referenceNumber: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((payment, context) => {
    if (
      ["MPESA", "ORANGE_MONEY", "AIRTEL_MONEY"].includes(payment.method) &&
      !payment.referenceNumber
    ) {
      context.addIssue({
        code: "custom",
        path: ["referenceNumber"],
        message: "La référence Mobile Money est obligatoire en phase 1.",
      });
    }
  });

const settleSchema = z.object({
  payments: z.array(paymentItemSchema).min(1),
  isCompleteSettlement: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isSameOrigin(request)) {
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  }

  const actor = await getAuthenticatedActor();
  if (!actor) {
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return noStoreJson(
      { error: "Identifiant de commande invalide." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = settleSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson(
      { error: "Règlements invalides.", details: parsed.error.format() },
      { status: 400 },
    );
  }

  try {
    const result = await settleOrderPaymentService(
      actor,
      orderId,
      parsed.data.payments,
      parsed.data.isCompleteSettlement ?? true,
    );
    return noStoreJson({
      completed: result.completed,
      orderId: result.orderId,
      receiptId: result.receiptId,
    });
  } catch (error) {
    return noStoreJson(
      {
        error: error instanceof Error ? error.message : "Erreur de règlement.",
      },
      { status: error instanceof OrderPrerequisiteError ? 409 : 400 },
    );
  }
}
