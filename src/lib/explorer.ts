import {
  createPublicClient,
  formatEther,
  formatUnits,
  http,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import type { AppConfig } from "./config";
import { explorerTxUrl, resolveChain } from "./network";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as const;

export type ExplorerTxView = {
  hash: Hash;
  network: string;
  nativeSymbol: string;
  externalUrl: string;
  status: "success" | "reverted" | "pending" | "not_found";
  blockNumber: string | null;
  timestamp: string | null;
  from: Address | null;
  to: Address | null;
  valueNative: string | null;
  gasUsed: string | null;
  effectiveGasPriceGwei: string | null;
  transfers: Array<{
    token: Address;
    tokenLabel: string;
    from: Address;
    to: Address;
    amount: string;
    decimals: number;
  }>;
};

function topicAddress(topic: Hex | undefined): Address | null {
  if (!topic || topic.length < 66) return null;
  return `0x${topic.slice(-40)}` as Address;
}

export async function loadExplorerTx(
  config: AppConfig,
  txHash: string,
): Promise<ExplorerTxView> {
  const hash = (txHash.startsWith("0x") ? txHash : `0x${txHash}`) as Hash;
  const externalUrl = explorerTxUrl(config, hash);
  const chain = resolveChain(config);
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const [tx, receipt] = await Promise.all([
    publicClient.getTransaction({ hash }).catch(() => null),
    publicClient.getTransactionReceipt({ hash }).catch(() => null),
  ]);

  if (!tx && !receipt) {
    return {
      hash,
      network: config.network,
      nativeSymbol: config.nativeSymbol,
      externalUrl,
      status: "not_found",
      blockNumber: null,
      timestamp: null,
      from: null,
      to: null,
      valueNative: null,
      gasUsed: null,
      effectiveGasPriceGwei: null,
      transfers: [],
    };
  }

  let timestamp: string | null = null;
  const blockNumber = receipt?.blockNumber ?? tx?.blockNumber ?? null;
  if (blockNumber != null) {
    try {
      const block = await publicClient.getBlock({ blockNumber });
      timestamp = new Date(Number(block.timestamp) * 1000).toISOString();
    } catch {
      timestamp = null;
    }
  }

  const mockAsset = config.mockAsset?.toLowerCase();
  const transfers: ExplorerTxView["transfers"] = [];
  for (const log of receipt?.logs ?? []) {
    if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
    const from = topicAddress(log.topics[1]);
    const to = topicAddress(log.topics[2]);
    if (!from || !to) continue;
    const token = log.address;
    const raw = BigInt(log.data || "0x0");
    const isMockAsset = mockAsset != null && token.toLowerCase() === mockAsset;
    const decimals = isMockAsset ? 6 : 18;
    transfers.push({
      token,
      tokenLabel: isMockAsset ? "ERC20" : token.slice(0, 10),
      from,
      to,
      amount: formatUnits(raw, decimals),
      decimals,
    });
  }

  let status: ExplorerTxView["status"] = "pending";
  if (receipt) status = receipt.status === "success" ? "success" : "reverted";

  const gasPrice = receipt?.effectiveGasPrice ?? tx?.gasPrice ?? null;

  return {
    hash,
    network: config.network,
    nativeSymbol: config.nativeSymbol,
    externalUrl,
    status,
    blockNumber: blockNumber != null ? blockNumber.toString() : null,
    timestamp,
    from: (tx?.from ?? receipt?.from ?? null) as Address | null,
    to: (tx?.to ?? receipt?.to ?? null) as Address | null,
    valueNative: tx ? formatEther(tx.value) : null,
    gasUsed: receipt?.gasUsed?.toString() ?? null,
    effectiveGasPriceGwei: gasPrice != null ? (Number(gasPrice) / 1e9).toFixed(4) : null,
    transfers,
  };
}
