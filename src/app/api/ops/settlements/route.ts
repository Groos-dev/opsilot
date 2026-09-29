import { NextRequest } from "next/server";
import { assertOpsAuth } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { getSettlement, listSettlements } from "@/lib/ledger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = assertOpsAuth(request);
  if (denied) return denied;
  const config = loadConfig();
  const key = request.nextUrl.searchParams.get("paymentKey");
  if (key) {
    const row = getSettlement(config.databasePath, key);
    if (!row) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json(row);
  }
  return Response.json({ items: listSettlements(config.databasePath, 100) });
}
