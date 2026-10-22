import type { MembershipRole } from "@/generated/prisma/client";

export function canManageCatalog(role: MembershipRole): boolean {
  return role === "OWNER" || role === "MANAGER";
}

export function canChangeCatalogAvailability(role: MembershipRole): boolean {
  return role === "OWNER" || role === "MANAGER" || role === "KITCHEN";
}
