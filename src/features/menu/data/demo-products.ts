type DemoProduct = {
  id: string;
  name: string;
  category: string;
  price: { amount: number; currency: "CDF" | "USD" };
  zonePrices: {
    terrace?: { amount: number; currency: "CDF" | "USD" };
    vip?: { amount: number; currency: "CDF" | "USD" };
  };
  available: boolean;
  dailyMenu: boolean;
  photoLabel: string;
  variants: string[];
  requiredAccompaniments: string[];
  paidExtras: string[];
};

/** Jeu entièrement fictif, réservé à l'interface de démonstration. */
const featuredDemoProducts: DemoProduct[] = [
  {
    id: "demo-poulet",
    name: "Poulet braisé",
    category: "Plats",
    price: { amount: 25000, currency: "CDF" },
    zonePrices: {
      terrace: { amount: 27000, currency: "CDF" },
      vip: { amount: 30000, currency: "CDF" },
    },
    available: true,
    dailyMenu: true,
    photoLabel: "PB",
    variants: ["Demi", "Entier"],
    requiredAccompaniments: ["Frites", "Bananes plantain", "Riz", "Chikwangue"],
    paidExtras: ["Piment maison", "Sauce supplémentaire"],
  },
  {
    id: "demo-poisson",
    name: "Poisson grillé",
    category: "Plats",
    price: { amount: 32000, currency: "CDF" },
    zonePrices: { terrace: { amount: 35000, currency: "CDF" } },
    available: true,
    dailyMenu: false,
    photoLabel: "PG",
    variants: ["Petit", "Grand"],
    requiredAccompaniments: ["Frites", "Riz", "Chikwangue"],
    paidExtras: ["Piment maison"],
  },
  {
    id: "demo-frites",
    name: "Frites maison",
    category: "Accompagnements",
    price: { amount: 8000, currency: "CDF" },
    zonePrices: {},
    available: true,
    dailyMenu: false,
    photoLabel: "FM",
    variants: [],
    requiredAccompaniments: [],
    paidExtras: ["Double portion"],
  },
  {
    id: "demo-jus",
    name: "Jus de gingembre",
    category: "Boissons",
    price: { amount: 3, currency: "USD" },
    zonePrices: { vip: { amount: 4, currency: "USD" } },
    available: true,
    dailyMenu: false,
    photoLabel: "JG",
    variants: ["25 cl", "50 cl"],
    requiredAccompaniments: [],
    paidExtras: [],
  },
  {
    id: "demo-brochette",
    name: "Brochette de bœuf",
    category: "Plats",
    price: { amount: 14000, currency: "CDF" },
    zonePrices: {},
    available: false,
    dailyMenu: false,
    photoLabel: "BB",
    variants: ["À l’unité", "Par deux"],
    requiredAccompaniments: ["Frites", "Bananes plantain"],
    paidExtras: ["Double fromage"],
  },
  {
    id: "demo-salade",
    name: "Salade du marché",
    category: "Entrées",
    price: { amount: 12000, currency: "CDF" },
    zonePrices: {},
    available: true,
    dailyMenu: false,
    photoLabel: "SM",
    variants: [],
    requiredAccompaniments: [],
    paidExtras: ["Avocat"],
  },
];

const generatedDemoProducts: DemoProduct[] = Array.from(
  { length: 144 },
  (_, index) => {
    const number = index + 7;
    const categories = ["Plats", "Accompagnements", "Boissons", "Entrées"];
    const category = categories[index % categories.length];
    const currency = index % 5 === 0 ? "USD" : "CDF";
    const amount =
      currency === "USD" ? 2 + (index % 9) : 5000 + (index % 16) * 1500;
    const demoPrice = { amount, currency } as const;

    return {
      id: `demo-generated-${String(number).padStart(3, "0")}`,
      name: `Article démo ${String(number).padStart(3, "0")}`,
      category,
      price: demoPrice,
      zonePrices: {
        ...(index % 3 === 0
          ? {
              terrace: {
                amount: amount + (currency === "USD" ? 1 : 2000),
                currency,
              },
            }
          : {}),
        ...(index % 4 === 0
          ? {
              vip: {
                amount: amount + (currency === "USD" ? 2 : 4000),
                currency,
              },
            }
          : {}),
      },
      available: index % 7 !== 0,
      dailyMenu: false,
      photoLabel: `D${String(number).slice(-2)}`,
      variants: index % 2 === 0 ? ["Standard", "Grande"] : [],
      requiredAccompaniments:
        category === "Plats" ? ["Accompagnement démo"] : [],
      paidExtras: index % 3 === 0 ? ["Supplément démo"] : [],
    } satisfies DemoProduct;
  },
);

/** 150 fiches fictives générées de façon stable pour tester recherche et pagination. */
export const demoProducts: DemoProduct[] = [
  ...featuredDemoProducts,
  ...generatedDemoProducts,
];

export const demoCategories = [
  "Toutes",
  "Plats",
  "Accompagnements",
  "Boissons",
  "Entrées",
];
