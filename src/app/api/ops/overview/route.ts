import { NextRequest } from "next/server";
import { formatEther } from "viem";
import { assertOpsAuth } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { getFacilitatorBundle } from "@/lib/facilitator";
import { listSettlements } from "@/lib/ledger";
import { gasBalanceGauge } from "@/lib/metrics";
import { ensureMockData, getChainMockSnapshot } from "@/lib/mock-data";
import { analyzeOps } from "@/lib/ops-agent";

export const runtime = "nodejs";

async function readLiveWallet(config: ReturnType<typeof loadConfig>) {
  const { publicClient, walletAddress } = getFacilitatorBundle(config);
  let rpcOk = true;
  let gasBalance = 0;
  try {
    const balance = await publicClient.getBalance({ address: walletAddress });
    gasBalance = Number(formatEther(balance));
    gasBalanceGauge.set({ address: walletAddress }, gasBalance);
    await publicClient.getBlockNumber();
  } catch {
    rpcOk = false;
  }
  return { walletAddress, gasBalance, rpcOk };
}

export async function GET(request: NextRequest) {
  const denied = assertOpsAuth(request);
  if (denied) return denied;

  const config = loadConfig();
  await ensureMockData(config);

  const chainMock = config.mockData ? getChainMockSnapshot() : null;
  const wallet = chainMock
    ? {
        address: chainMock.address,
        gasBalance: chainMock.gasBalance,
        rpcOk: chainMock.rpcOk,
      }
    : await readLiveWallet(config);

  gasBalanceGauge.set({ address: wallet.address }, wallet.gasBalance);

  return Response.json({
    product: "Opsilot",
    slogan: "不仅仅只是结算",
    mock: config.mockData,
    mockSource: chainMock?.source ?? null,
    network: config.network,
    nativeSymbol: config.nativeSymbol,
    wallet: {
      address: wallet.address,
      gasBalance: wallet.gasBalance,
      alertThreshold: config.gasAlertThreshold,
      low: wallet.gasBalance < config.gasAlertThreshold,
    },
    rpcOk: wallet.rpcOk,
    settlements: listSettlements(config.databasePath, 50),
  });
}

export async function POST(request: NextRequest) {
  const denied = assertOpsAuth(request);
  if (denied) return denied;
  const config = loadConfig();
  await ensureMockData(config);

  const chainMock = config.mockData ? getChainMockSnapshot() : null;
  const wallet = chainMock
    ? { gasBalance: chainMock.gasBalance, rpcOk: chainMock.rpcOk }
    : await readLiveWallet(config);

  const report = analyzeOps({
    databasePath: config.databasePath,
    gasBalance: wallet.gasBalance,
    gasAlertThreshold: config.gasAlertThreshold,
    nativeSymbol: config.nativeSymbol,
    rpcOk: wallet.rpcOk,
  });
  return Response.json(report);
}
