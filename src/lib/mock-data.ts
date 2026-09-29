import {
  createPublicClient,
  formatEther,
  http,
  parseAbiItem,
  type Address,
  type Hash,
  type Log,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { AppConfig } from "./config";
import { clearSettlements, upsertSettlement } from "./ledger";
import { resolveChain } from "./network";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export type ChainMockSnapshot = {
  address: Address;
  gasBalance: number;
  nativeSymbol: string;
  rpcOk: boolean;
  blockNumber: string;
  source: "erc20-transfers";
  asset: Address | null;
  seeded: number;
};

let snapshot: ChainMockSnapshot | null = null;
let seedPromise: Promise<void> | null = null;

export function getChainMockSnapshot(): ChainMockSnapshot | null {
  return snapshot;
}

function topicAddress(topic: Hash | undefined): Address | null {
  if (!topic || topic.length < 66) return null;
  return `0x${topic.slice(-40)}` as Address;
}

function amountFromLog(log: Log): string {
  const data = log.data;
  if (!data || data === "0x") return "0";
  try {
    return BigInt(data).toString();
  } catch {
    return "0";
  }
}

async function seedFromChain(config: AppConfig): Promise<void> {
  const account = privateKeyToAccount(config.settlementPrivateKey);
  const chain = resolveChain(config);
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  let rpcOk = true;
  let gasBalance = 0;
  let blockNumber = 0n;
  try {
    const [balance, latest] = await Promise.all([
      publicClient.getBalance({ address: account.address }),
      publicClient.getBlockNumber(),
    ]);
    gasBalance = Number(formatEther(balance));
    blockNumber = latest;
  } catch {
    rpcOk = false;
  }

  let seeded = 0;
  const asset = config.mockAsset;

  if (rpcOk && blockNumber > 0n && asset) {
    const lookback = 8_000n;
    const fromBlock = blockNumber > lookback ? blockNumber - lookback : 0n;
    const logs = await publicClient.getLogs({
      address: asset,
      event: TRANSFER_EVENT,
      fromBlock,
      toBlock: blockNumber,
    });

    const newestFirst = [...logs].reverse();
    const seenTx = new Set<string>();
    const picked: Log[] = [];
    for (const log of newestFirst) {
      const tx = log.transactionHash;
      if (!tx || seenTx.has(tx)) continue;
      seenTx.add(tx);
      picked.push(log);
      if (picked.length >= 12) break;
    }

    clearSettlements(config.databasePath);

    for (const log of picked) {
      const txHash = log.transactionHash!;
      const payTo = topicAddress(log.topics[2]) ?? account.address;
      const amount = amountFromLog(log);
      let createdAt = new Date().toISOString();
      try {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
        createdAt = new Date(Number(block.timestamp) * 1000).toISOString();
      } catch {
        // keep now
      }

      upsertSettlement(config.databasePath, {
        payment_key: `onchain_${txHash}_${log.logIndex ?? 0}`,
        status: "success",
        tx_hash: txHash,
        network: config.network,
        asset,
        amount,
        pay_to: payTo,
        error_reason: null,
        created_at: createdAt,
      });
      seeded += 1;
    }
  }

  snapshot = {
    address: account.address,
    gasBalance,
    nativeSymbol: config.nativeSymbol,
    rpcOk,
    blockNumber: blockNumber.toString(),
    source: "erc20-transfers",
    asset,
    seeded,
  };
}

/** When MOCK_DATA is on: seed ledger from recent ERC-20 transfers of MOCK_ASSET on the configured network. */
export async function ensureMockData(config: AppConfig): Promise<void> {
  if (!config.mockData) return;
  if (!seedPromise) seedPromise = seedFromChain(config);
  await seedPromise;
}
