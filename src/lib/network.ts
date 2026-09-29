import { defineChain, type Chain } from "viem";
import {
  abstract,
  abstractTestnet,
  avalanche,
  avalancheFuji,
  base,
  baseSepolia,
  celo,
  mainnet,
  polygon,
  polygonAmoy,
  sepolia,
} from "viem/chains";
import type { AppConfig } from "./config";

const BY_CAIP: Record<string, Chain> = {
  "eip155:1": mainnet,
  "eip155:11155111": sepolia,
  "eip155:8453": base,
  "eip155:84532": baseSepolia,
  "eip155:137": polygon,
  "eip155:80002": polygonAmoy,
  "eip155:43114": avalanche,
  "eip155:43113": avalancheFuji,
  "eip155:42220": celo,
  "eip155:2741": abstract,
  "eip155:11124": abstractTestnet,
  ethereum: mainnet,
  sepolia,
  base,
  "base-sepolia": baseSepolia,
  polygon,
  "polygon-amoy": polygonAmoy,
  avalanche,
  "avalanche-fuji": avalancheFuji,
};

function chainIdFromNetwork(network: string): number | null {
  const match = /^eip155:(\d+)$/.exec(network.trim());
  return match ? Number(match[1]) : null;
}

/** Resolve a viem chain from CAIP-2 / alias; unknown nets become a custom RPC-backed chain. */
export function resolveChain(config: AppConfig): Chain {
  const known = BY_CAIP[config.network];
  if (known) return known;

  const id = config.chainId || chainIdFromNetwork(config.network);
  if (!id) {
    throw new Error(`cannot resolve chain for NETWORK=${config.network}; set CHAIN_ID`);
  }

  return defineChain({
    id,
    name: config.network,
    nativeCurrency: {
      name: config.nativeSymbol,
      symbol: config.nativeSymbol,
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [config.rpcUrl] },
    },
    blockExplorers: config.explorerBaseUrl
      ? {
          default: {
            name: "Explorer",
            url: config.explorerBaseUrl.replace(/\/$/, ""),
          },
        }
      : undefined,
  });
}

export function explorerTxUrl(config: AppConfig, txHash: string): string {
  if (config.explorerTxUrlTemplate) {
    return config.explorerTxUrlTemplate.replace("{txHash}", txHash).replace("{hash}", txHash);
  }
  const base = config.explorerBaseUrl?.replace(/\/$/, "");
  if (base) return `${base}/tx/${txHash}`;

  const chain = resolveChain(config);
  const explorer = chain.blockExplorers?.default?.url;
  if (explorer) return `${explorer.replace(/\/$/, "")}/tx/${txHash}`;

  return `https://blockscan.com/tx/${txHash}`;
}
