import { NextRequest } from "next/server";
import { assertOpsAuth } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { getFacilitatorBundle } from "@/lib/facilitator";
import { reconcileTx } from "@/lib/reconcile";

export const runtime = "nodejs";

type Params = { params: Promise<{ txHash: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const denied = assertOpsAuth(request);
  if (denied) return denied;
  const { txHash } = await params;
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return Response.json({ error: "invalid_tx_hash" }, { status: 400 });
  }
  const config = loadConfig();
  const { publicClient } = getFacilitatorBundle(config);
  const result = await reconcileTx(publicClient, txHash as `0x${string}`);
  return Response.json(result);
}
