import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/server/auth/session";
import { UsersWorkspace } from "@/features/users/components/users-workspace";

export const metadata: Metadata = {
  title: "Utilisateurs — Resto+",
  description: "Gestion des comptes et rôles",
};

export default async function UsersPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    redirect("/login");
  }
  return <UsersWorkspace />;
}