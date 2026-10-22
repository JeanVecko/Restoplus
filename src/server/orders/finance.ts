import type { OrderCurrency, OrderLineInput, PaymentInput } from "./types";

/**
 * Calcule le prix unitaire et le sous-total d'une ligne de commande
 * dans sa devise d'origine (prix de base + suppléments de même devise).
 */
export function computeLineTotal(line: OrderLineInput): {
  unitPrice: number;
  subtotal: number;
  currency: OrderCurrency;
} {
  const quantity = Math.max(1, line.quantity);
  const basePrice = Math.max(0, line.unitPriceAmount);

  // Somme des extras exprimés dans la même devise que l'article
  const extrasTotal = (line.selectedExtras ?? []).reduce((acc, extra) => {
    if (extra.currency !== line.currency) {
      throw new Error(
        `Devise de supplément incompatible (${extra.currency} vs ${line.currency}).`,
      );
    }
    return acc + Math.max(0, extra.amount);
  }, 0);

  const unitPrice = basePrice + extrasTotal;
  const subtotal = unitPrice * quantity;

  return {
    unitPrice,
    subtotal,
    currency: line.currency,
  };
}

/**
 * Calcule le cumul des totaux de commande ventilés par devise d'origine (CDF, USD),
 * sans conversion automatique ni arrondi forcé.
 */
export function computeOrderTotalsByCurrency(
  lines: OrderLineInput[],
): Record<OrderCurrency, number> {
  const totals: Record<OrderCurrency, number> = {
    CDF: 0,
    USD: 0,
  };

  for (const line of lines) {
    const { subtotal, currency } = computeLineTotal(line);
    totals[currency] = (totals[currency] ?? 0) + subtotal;
  }

  return totals;
}

/**
 * Calcule le cumul des paiements reçus ventilés par devise d'origine.
 */
export function computePaymentsByCurrency(
  payments: PaymentInput[],
): Record<OrderCurrency, number> {
  const totals: Record<OrderCurrency, number> = {
    CDF: 0,
    USD: 0,
  };

  for (const payment of payments) {
    const amount = Math.max(0, payment.amountPaid);
    totals[payment.currencyPaid] = (totals[payment.currencyPaid] ?? 0) + amount;
  }

  return totals;
}
