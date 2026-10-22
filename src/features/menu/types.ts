export type MenuCurrency = "CDF" | "USD";

export type MenuPrice = {
  amount: string;
  currency: MenuCurrency;
};

export type MenuVariant = {
  id: string;
  name: string;
  standardPriceAmount: string;
  zonePrices: Partial<Record<"TERRACE" | "VIP", string>>;
  available: boolean;
  active: boolean;
  displayOrder: number;
};

export type MenuOption = {
  id: string;
  name: string;
  kind: "INCLUDED" | "PAID";
  priceAmount: string;
  currency: MenuCurrency;
  available: boolean;
  active: boolean;
  displayOrder: number;
};

export type MenuCategory = {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
};

export type Product = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  category: string;
  preparationStation: "CUISINE" | "BAR";
  price: MenuPrice;
  zonePrices: {
    terrace?: MenuPrice;
    vip?: MenuPrice;
  };
  available: boolean;
  dailyMenu: boolean;
  active: boolean;
  displayOrder: number;
  photoLabel: string;
  variants: MenuVariant[];
  requiredAccompaniments: MenuOption[];
  paidExtras: MenuOption[];
};
