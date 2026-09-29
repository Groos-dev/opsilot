import { loadConfig } from "@/lib/config";
import { getFacilitatorBundle } from "@/lib/facilitator";
import { ensureMockData, getChainMockSnapshot } from "@/lib/mock-data";
import { formatEther } from "viem";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = loadConfig();
    await ensureMockData(config);

    if (config.mockData) {
      const snap = getChainMockSnapshot();
      return Response.json({
        ok: true,
        product: "Opsilot",
        slogan: "不仅仅只是结算",
        mock: true,
        mockSource: snap?.source ?? null,
        network: config.network,
        nativeSymbol: config.nativeSymbol,
        walletAddress: snap?.address,
        blockNumber: snap?.blockNumber ?? "0",
        gasBalance: String(snap?.gasBalance ?? 0),
        seededSettlements: snap?.seeded ?? 0,
        supportedKinds: 24,
      });
    }

    const { publicClient, walletAddress, facilitator } = getFacilitatorBundle(config);
    const [blockNumber, balance] = await Promise.all([
      publicClient.getBlockNumber(),
      publicClient.getBalance({ address: walletAddress }),
    ]);
    const supported = facilitator.getSupported();
    return Response.json({
      ok: true,
      product: "Opsilot",
      slogan: "不仅仅只是结算",
      mock: false,
      network: config.network,
      nativeSymbol: config.nativeSymbol,
      walletAddress,
      blockNumber: blockNumber.toString(),
      gasBalance: formatEther(balance),
      supportedKinds: supported.kinds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: message }, { status: 503 });
  }
}
