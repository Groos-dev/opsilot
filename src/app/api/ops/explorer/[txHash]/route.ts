import { NextRequest } from "next/server";
import { assertOpsAuth } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { loadExplorerTx } from "@/lib/explorer";

export const runtime = "nodejs";

type Params = { params: Promise<{ txHash: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const denied = assertOpsAuth(request);
  if (denied) return denied;

  const { txHash } = await params;
  const normalized = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    return Response.json({ error: "invalid_tx_hash" }, { status: 400 });
  }

  try {
    const view = await loadExplorerTx(loadConfig(), normalized);
    return Response.json(view);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
