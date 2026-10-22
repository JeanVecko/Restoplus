import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/server/auth/session";
import { TablesWorkspace } from "@/features/tables/components/tables-workspace";

export const metadata: Metadata = {
  title: "Tables — Resto+",
  description: "Gestion des tables et zones tarifaires",
};

export default async function TablesPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    redirect("/login");
  }
  return <TablesWorkspace />;
}