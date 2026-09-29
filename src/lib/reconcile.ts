import type { Hex } from "viem";

export type ReconcileResult = {
  status: "success" | "pending" | "failed" | "unknown";
  txHash: Hex;
  detail: string;
};

type ReceiptReader = {
  getTransactionReceipt: (args: { hash: Hex }) => Promise<{ status: "success" | "reverted" }>;
  getTransaction: (args: { hash: Hex }) => Promise<unknown>;
};

export async function reconcileTx(publicClient: ReceiptReader, txHash: Hex): Promise<ReconcileResult> {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (receipt.status === "success") {
      return { status: "success", txHash, detail: "transaction mined successfully" };
    }
    return { status: "failed", txHash, detail: "transaction mined but reverted" };
  } catch {
    try {
      const tx = await publicClient.getTransaction({ hash: txHash });
      if (tx) {
        return { status: "pending", txHash, detail: "transaction found but not yet mined" };
      }
    } catch {
      // fall through
    }
    return { status: "unknown", txHash, detail: "transaction not found on RPC" };
  }
}
