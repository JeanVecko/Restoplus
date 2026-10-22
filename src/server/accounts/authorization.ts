import type { MembershipRole } from "@/generated/prisma/client";

export type MemberChange = {
  actorId: string;
  actorRole: MembershipRole;
  targetId: string;
  targetRole: MembershipRole;
  newRole?: MembershipRole;
  newMembershipActive?: boolean;
  newUserActive?: boolean;
};

export function canManageMember(change: MemberChange): boolean {
  const { actorId, actorRole, targetId, targetRole, newRole } = change;
  if (actorRole !== "OWNER" && actorRole !== "MANAGER") return false;
  if (actorRole === "MANAGER" && targetRole === "OWNER") return false;
  if (newRole === "OWNER") {
    return actorRole === "OWNER" && targetId !== actorId;
  }
  return true;
}

export function isOperationalInviteRole(role: MembershipRole): boolean {
  return role !== "OWNER";
}
