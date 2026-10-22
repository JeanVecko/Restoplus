export type CatalogZone = "STANDARD" | "TERRACE" | "VIP";

/**
 * Deterministic catalog fallback. A missing variant override falls back to the
 * product tariff for the requested zone, then to the product Standard tariff.
 */
export function resolveCatalogBasePrice(input: {
  zone: CatalogZone;
  productStandard: string;
  productTerrace?: string;
  productVip?: string;
  variantStandard?: string;
  variantTerrace?: string;
  variantVip?: string;
}): string {
  if (input.zone === "STANDARD") {
    return input.variantStandard ?? input.productStandard;
  }
  const variantZone =
    input.zone === "TERRACE" ? input.variantTerrace : input.variantVip;
  const productZone =
    input.zone === "TERRACE" ? input.productTerrace : input.productVip;
  return variantZone ?? productZone ?? input.productStandard;
}
