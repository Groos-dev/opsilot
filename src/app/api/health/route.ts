import { loadConfig } from "@/lib/config";
import { getFacilitatorBundle } from "@/lib/facilitator";
import { formatEther } from "viem";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = loadConfig();
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
      network: config.network,
      walletAddress,
      blockNumber: blockNumber.toString(),
      gasBalanceAvax: formatEther(balance),
      supportedKinds: supported.kinds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: message }, { status: 503 });
  }
}
