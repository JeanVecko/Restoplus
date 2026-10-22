export type OrderStation = "CUISINE" | "BAR";
export type OrderStatus = "WAITING_CASHIER" | "IN_PREPARATION" | "READY";
export type TicketStatus = "PENDING" | "IN_PREPARATION" | "READY";
export type OrderCurrency = "CDF" | "USD";

export type OrderProduct = {
  id: string;
  name: string;
  station: OrderStation;
  amount: number;
  currency: OrderCurrency;
};

export type OrderLine = OrderProduct & { quantity: number };

export type WorkTicket = {
  id: string;
  number: string;
  station: OrderStation;
  status: TicketStatus;
  items: OrderLine[];
  issuedAt: string;
};

export type DemoOrder = {
  id: string;
  number: string;
  table: string;
  createdBy: string;
  createdAt: string;
  status: OrderStatus;
  lines: OrderLine[];
  cashierValidatedAt?: string;
  tickets: WorkTicket[];
};

export type DemoOrderState = {
  orders: DemoOrder[];
};

export const demoProducts: OrderProduct[] = [
  {
    id: "poulet",
    name: "Poulet braisé",
    station: "CUISINE",
    amount: 25000,
    currency: "CDF",
  },
  {
    id: "poisson",
    name: "Poisson grillé",
    station: "CUISINE",
    amount: 30000,
    currency: "CDF",
  },
  {
    id: "frites",
    name: "Frites",
    station: "CUISINE",
    amount: 5000,
    currency: "CDF",
  },
  {
    id: "chikwangue",
    name: "Chikwangue",
    station: "CUISINE",
    amount: 5000,
    currency: "CDF",
  },
  {
    id: "jus",
    name: "Jus naturel",
    station: "BAR",
    amount: 4000,
    currency: "CDF",
  },
  {
    id: "eau",
    name: "Eau minérale",
    station: "BAR",
    amount: 2,
    currency: "USD",
  },
];

const demoNow = "2026-10-20T12:10:00.000Z";

export const initialDemoState: DemoOrderState = {
  orders: [
    {
      id: "demo-waiting-cashier",
      number: "CMD-D-0248",
      table: "Table 03",
      createdBy: "Serveur démo",
      createdAt: demoNow,
      status: "WAITING_CASHIER",
      lines: [
        { ...demoProducts[0], quantity: 1 },
        { ...demoProducts[4], quantity: 2 },
      ],
      tickets: [],
    },
    {
      id: "demo-in-preparation",
      number: "CMD-D-0247",
      table: "Table 05",
      createdBy: "Serveur démo",
      createdAt: "2026-10-20T12:02:00.000Z",
      status: "IN_PREPARATION",
      cashierValidatedAt: "2026-10-20T12:04:00.000Z",
      lines: [
        { ...demoProducts[1], quantity: 1 },
        { ...demoProducts[2], quantity: 1 },
        { ...demoProducts[5], quantity: 1 },
      ],
      tickets: [
        {
          id: "demo-ticket-kitchen",
          number: "BON-D-0247-C",
          station: "CUISINE",
          status: "IN_PREPARATION",
          items: [
            { ...demoProducts[1], quantity: 1 },
            { ...demoProducts[2], quantity: 1 },
          ],
          issuedAt: "2026-10-20T12:04:00.000Z",
        },
        {
          id: "demo-ticket-bar",
          number: "BON-D-0247-B",
          station: "BAR",
          status: "READY",
          items: [{ ...demoProducts[5], quantity: 1 }],
          issuedAt: "2026-10-20T12:04:00.000Z",
        },
      ],
    },
  ],
};

export function formatDemoPrice(amount: number, currency: OrderCurrency) {
  const value = new Intl.NumberFormat("fr-CD", {
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(amount);
  return currency === "CDF" ? `${value} FC` : `$ ${value}`;
}

export function nextDemoOrderNumber(orders: DemoOrder[]) {
  const largest = orders.reduce((max, order) => {
    const number = Number(order.number.match(/(\d+)$/)?.[1] ?? 0);
    return Math.max(max, number);
  }, 0);
  return `CMD-D-${String(largest + 1).padStart(4, "0")}`;
}

export function groupLinesByStation(lines: OrderLine[]) {
  return (Object.keys({ CUISINE: true, BAR: true }) as OrderStation[])
    .map((station) => ({
      station,
      items: lines.filter((line) => line.station === station),
    }))
    .filter((group) => group.items.length > 0);
}
