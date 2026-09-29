import { x402Facilitator } from "@x402/core/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { createPublicClient, createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { AppConfig } from "./config";
import { resolveChain } from "./network";

export type FacilitatorBundle = {
  facilitator: InstanceType<typeof x402Facilitator>;
  walletAddress: `0x${string}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
};

let cached: FacilitatorBundle | null = null;

export function getFacilitatorBundle(config: AppConfig): FacilitatorBundle {
  if (cached) return cached;

  const account = privateKeyToAccount(config.settlementPrivateKey);
  const chain = resolveChain(config);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport }).extend(publicActions);

  const signer = toFacilitatorEvmSigner(
    {
      address: account.address,
      readContract: (args) => publicClient.readContract(args as never),
      verifyTypedData: (args) => publicClient.verifyTypedData(args as never),
      writeContract: (args) => walletClient.writeContract(args as never),
      sendTransaction: (args) => walletClient.sendTransaction(args as never),
      waitForTransactionReceipt: (args) => publicClient.waitForTransactionReceipt(args as never),
      getCode: (args) => publicClient.getCode(args as never),
    },
    { confirmationTimeoutMs: config.confirmationTimeoutMs },
  );

  const facilitator = new x402Facilitator();
  registerExactEvmScheme(facilitator, {
    signer,
    networks: config.network as `${string}:${string}`,
  });

  cached = { facilitator, walletAddress: account.address, publicClient };
  return cached;
}
