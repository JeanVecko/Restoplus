import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedActor } from "@/server/auth/session";
import { withTenantTransaction } from "@/server/db/tenant-transaction";
import { isSameOrigin, noStoreJson } from "@/server/api/security";
import {
  createDiningTable,
  deactivateDiningTable,
  listDiningTables,
  updateDiningTable,
} from "@/server/tables/service";

export async function GET() {
  const actor = await getAuthenticatedActor();
  if (!actor)
    return noStoreJson({ error: "Authentification requise." }, { status: 401 });
  try {
    const tables = await listDiningTables(actor);
    return noStoreJson({ tables });
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
    const { id } = await createDiningTable(actor, await request.json());
    return noStoreJson({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return noStoreJson({ error: "Données de table invalides." }, { status: 400 });
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Erreur serveur." },
      { status: 409 },
    );
  }
}