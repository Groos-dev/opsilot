import { NextRequest } from "next/server";
import { formatEther } from "viem";
import { assertOpsAuth } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { getFacilitatorBundle } from "@/lib/facilitator";
import { getSettlement, listSettlements } from "@/lib/ledger";
import { gasBalanceGauge } from "@/lib/metrics";
import { analyzeOps } from "@/lib/ops-agent";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = assertOpsAuth(request);
  if (denied) return denied;

  const config = loadConfig();
  const { publicClient, walletAddress } = getFacilitatorBundle(config);
  let rpcOk = true;
  let gasBalanceAvax = 0;
  try {
    const balance = await publicClient.getBalance({ address: walletAddress });
    gasBalanceAvax = Number(formatEther(balance));
    gasBalanceGauge.set({ address: walletAddress }, gasBalanceAvax);
    await publicClient.getBlockNumber();
  } catch {
    rpcOk = false;
  }

  return Response.json({
    product: "Opsilot",
    slogan: "不仅仅只是结算",
    network: config.network,
    wallet: {
      address: walletAddress,
      gasBalanceAvax,
      alertThresholdAvax: config.gasAlertThresholdAvax,
      low: gasBalanceAvax < config.gasAlertThresholdAvax,
    },
    rpcOk,
    settlements: listSettlements(config.databasePath, 50),
  });
}

export async function POST(request: NextRequest) {
  const denied = assertOpsAuth(request);
  if (denied) return denied;
  const config = loadConfig();
  const { publicClient, walletAddress } = getFacilitatorBundle(config);
  let rpcOk = true;
  let gasBalanceAvax = 0;
  try {
    const balance = await publicClient.getBalance({ address: walletAddress });
    gasBalanceAvax = Number(formatEther(balance));
    await publicClient.getBlockNumber();
  } catch {
    rpcOk = false;
  }
  const report = analyzeOps({
    databasePath: config.databasePath,
    gasBalanceAvax,
    gasAlertThresholdAvax: config.gasAlertThresholdAvax,
    rpcOk,
  });
  return Response.json(report);
}
