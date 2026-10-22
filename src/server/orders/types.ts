export type OrderStation = "CUISINE" | "BAR";
export type OrderStatus =
  "WAITING_CASHIER" | "IN_PREPARATION" | "READY" | "COMPLETED" | "CANCELLED";
export type TicketStatus = "PENDING" | "IN_PREPARATION" | "READY";
export type OrderCurrency = "CDF" | "USD";

export type PaymentMethod =
  "CASH_CDF" | "CASH_USD" | "MPESA" | "ORANGE_MONEY" | "AIRTEL_MONEY" | "CARD";

/** Existing pure calculation input; persistent order creation accepts identifiers only. */
export type OrderLineInput = {
  productId: string;
  productName: string;
  station: OrderStation;
  quantity: number;
  unitPriceAmount: number;
  currency: OrderCurrency;
  selectedAccompaniments?: string[];
  selectedExtras?: Array<{
    name: string;
    amount: number;
    currency: OrderCurrency;
  }>;
  notes?: string;
};

export type CreateOrderInput = {
  tableNumber?: string;
  coversCount?: number;
  isTakeaway?: boolean;
  notes?: string;
  lines: Array<{
    productId: string;
    quantity: number;
    variantId?: string;
    includedOptionIds?: string[];
    paidOptionIds?: string[];
    notes?: string;
  }>;
};

export type PaymentInput = {
  method: PaymentMethod;
  amountPaid: number;
  currencyPaid: OrderCurrency;
  referenceNumber?: string;
};

export type SettleBillInput = {
  orderId: string;
  payments: PaymentInput[];
  discountAmountCdf?: number;
  discountReason?: string;
  serviceFeePercent?: number;
};
