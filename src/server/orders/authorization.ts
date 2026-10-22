import type { MembershipRole } from "@/generated/prisma/client";

/**
 * Vérifie si le rôle a le droit de créer une commande (en salle ou à emporter).
 * Autorisé pour OWNER, MANAGER, CASHIER, WAITER.
 */
export function canCreateOrder(role: MembershipRole): boolean {
  return ["OWNER", "MANAGER", "CASHIER", "WAITER"].includes(role);
}

/**
 * Vérifie si le rôle a le droit de valider une commande à la caisse et d'émettre
 * les bons de commande vers la cuisine et le bar.
 * Autorisé pour OWNER, MANAGER, CASHIER.
 */
export function canValidateOrderAtCashier(role: MembershipRole): boolean {
  return ["OWNER", "MANAGER", "CASHIER"].includes(role);
}

/**
 * Vérifie si le rôle a le droit de faire progresser le statut d'un bon de préparation (Cuisine/Bar).
 * Autorisé pour OWNER, MANAGER, KITCHEN.
 */
export function canUpdateTicketStatus(role: MembershipRole): boolean {
  return ["OWNER", "MANAGER", "KITCHEN"].includes(role);
}

/** Seules les transitions avant prévues par le circuit sont permises. */
export function canTransitionTicketStatus(
  current: "PENDING" | "IN_PREPARATION" | "READY",
  next: "PENDING" | "IN_PREPARATION" | "READY",
): boolean {
  return (
    (current === "PENDING" && next === "IN_PREPARATION") ||
    (current === "IN_PREPARATION" && next === "READY")
  );
}

/**
 * Vérifie si le rôle a le droit d'encaisser un règlement et de clôturer une addition.
 * Autorisé pour OWNER, MANAGER, CASHIER.
 */
export function canProcessPayment(role: MembershipRole): boolean {
  return ["OWNER", "MANAGER", "CASHIER"].includes(role);
}

/**
 * Vérifie si le rôle a le droit d'annuler une commande validée ou en cours.
 * Réservé exclusivement à OWNER et MANAGER (avec motif obligatoire et audit).
 * Un serveur ne peut JAMAIS annuler une commande sans accord gérant.
 */
export function canCancelOrder(role: MembershipRole): boolean {
  return ["OWNER", "MANAGER"].includes(role);
}

/**
 * Vérifie si le rôle a le droit d'appliquer une remise sur une addition.
 * Réservé exclusivement à OWNER et MANAGER.
 */
export function canApplyDiscount(role: MembershipRole): boolean {
  return ["OWNER", "MANAGER"].includes(role);
}

/**
 * Vérifie si le rôle a le droit de définir ou modifier le taux de change du jour.
 * Réservé exclusivement à OWNER et MANAGER.
 */
export function canSetDailyExchangeRate(role: MembershipRole): boolean {
  return ["OWNER", "MANAGER"].includes(role);
}
