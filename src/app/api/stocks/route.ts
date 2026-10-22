import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedActor } from "@/server/auth/session";
import { isSameOrigin, noStoreJson } from "@/server/api/security";
import {
  createStockItem,
  deactivateStockItem,
  listStockItems,
  updateStockItem,
} from "@/server/stocks/service";

export async function GET() {
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  try {
    const items = await listStockItems(actor);
    return noStoreJson({ items });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Erreur serveur." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  try {
    const { id } = await createStockItem(actor, await request.json());
    return noStoreJson({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return noStoreJson({ error: "Données de stock invalides." }, { status: 400 });
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Erreur serveur." },
      { status: 409 },
    );
  }
}