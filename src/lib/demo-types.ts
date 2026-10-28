/** Types retained for the standalone UI examples; they are not server models. */
export type AuthenticatedActor = {
  displayName: string;
  restaurantName: string;
  restaurantCode: string;
  role: string;
};

export type OrderRecord = {
  id: string;
  orderNumber: string;
  isTakeaway: boolean;
  tableName: string;
  serverName: string;
  status: "WAITING_CASHIER" | "IN_PREPARATION" | "READY" | "COMPLETED" | "CANCELLED";
  createdAt: Date | null;
  lines: Array<{ quantity: number; currency: "CDF" | "USD"; unitPriceAmount: string | number }>;
};

export type DiningTable = {
  id: string;
  tableNumber: string;
  zone: "STANDARD" | "TERRACE" | "VIP";
  capacity: number;
  isActive: boolean;
  status?: string;
};

export type StockItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  threshold: number;
  currency: "CDF" | "USD";
  isActive: boolean;
};
