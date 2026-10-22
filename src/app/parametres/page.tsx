import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/server/auth/session";
import { SettingsWorkspace } from "@/features/settings/components/settings-workspace";

export const metadata: Metadata = {
  title: "Parametres — Resto+",
  description: "Configuration du restaurant",
};



export default async function SettingsPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    redirect("/login");
  }
  return <SettingsWorkspace actor={actor} />;
}
