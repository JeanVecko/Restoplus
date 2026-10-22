import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/server/auth/session";
import { StocksWorkspace } from "@/features/stocks/components/stocks-workspace";

export const metadata: Metadata = {
  title: "Stocks — Resto+",
  description: "Gestion des articles de stock et seuils d'alerte",
};

export default async function StocksPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    redirect("/login");
  }
  return <StocksWorkspace />;
}