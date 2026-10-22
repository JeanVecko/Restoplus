import { NextResponse } from "next/server";
import { getAuthenticatedActor } from "@/server/auth/session";
import { isSameOrigin, noStoreJson } from "@/server/api/security";
import { deactivateDiningTable, updateDiningTable } from "@/server/tables/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> },
) {
  if (!isSameOrigin(request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  const { tableId } = await params;
  try {
    await updateDiningTable(actor, tableId, await request.json());
    return noStoreJson({ id: tableId });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Erreur serveur." },
      { status: 409 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tableId: string }> },
) {
  if (!isSameOrigin(_request))
    return noStoreJson({ error: "Origine refusée." }, { status: 403 });
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  const { tableId } = await params;
  try {
    await deactivateDiningTable(actor, tableId);
    return noStoreJson({ id: tableId, deactivated: true });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Erreur serveur." },
      { status: 409 },
    );
  }
}