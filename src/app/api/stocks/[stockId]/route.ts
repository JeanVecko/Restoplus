import { NextResponse } from "next/server";
import { getAuthenticatedActor } from "@/server/auth/session";
import { isSameOrigin, noStoreJson } from "@/server/api/security";
import { deactivateStockItem, updateStockItem } from "@/server/stocks/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ stockId: string }> },
) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  const { stockId } = await params;
  try {
    await updateStockItem(actor, stockId, await request.json());
    return noStoreJson({ id: stockId });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Erreur serveur." },
      { status: 409 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stockId: string }> },
) {
  if (!isSameOrigin(_request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  const { stockId } = await params;
  try {
    await deactivateStockItem(actor, stockId);
    return noStoreJson({ id: stockId, deactivated: true });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Erreur serveur." },
      { status: 409 },
    );
  }
}