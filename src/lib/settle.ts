import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { loadConfig } from "./config";
import { getFacilitatorBundle } from "./facilitator";
import { getSettlement, upsertSettlement } from "./ledger";
import { paymentKeyFromPayload } from "./payment-key";
import { settleQueue } from "./queue";
import { reconcileTx } from "./reconcile";
import { settleCounters } from "./metrics";

function requirementsMeta(requirements: PaymentRequirements) {
  return {
    network: String(requirements.network ?? ""),
    asset: String(requirements.asset ?? ""),
    amount: String(requirements.amount ?? ""),
    pay_to: String(requirements.payTo ?? ""),
  };
}

export async function settleWithOps(body: {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}) {
  const config = loadConfig();
  const { facilitator, walletAddress, publicClient } = getFacilitatorBundle(config);
  const paymentKey = paymentKeyFromPayload(body.paymentPayload);
  const meta = requirementsMeta(body.paymentRequirements);

  const existing = getSettlement(config.databasePath, paymentKey);
  if (existing?.status === "success") {
    settleCounters.idempotentHits.inc();
    return {
      success: true,
      transaction: existing.tx_hash,
      network: existing.network,
      payer: undefined,
      errorReason: undefined,
      opsilot: { paymentKey, reused: true },
    };
  }

  if (existing?.status === "pending" && existing.tx_hash) {
    const reconciled = await reconcileTx(publicClient, existing.tx_hash as `0x${string}`);
    if (reconciled.status === "success") {
      upsertSettlement(config.databasePath, {
        payment_key: paymentKey,
        status: "success",
        tx_hash: existing.tx_hash,
        error_reason: null,
        ...meta,
      });
      return {
        success: true,
        transaction: existing.tx_hash,
        network: existing.network,
        opsilot: { paymentKey, reconciled: true },
      };
    }
    if (reconciled.status === "pending" || reconciled.status === "unknown") {
      return {
        success: false,
        errorReason: "settlement_pending",
        transaction: existing.tx_hash,
        network: existing.network,
        opsilot: { paymentKey, detail: reconciled.detail },
      };
    }
  }

  return settleQueue.enqueue(walletAddress, async () => {
    settleCounters.settleAttempts.inc();
    try {
      const result = await facilitator.settle(body.paymentPayload, body.paymentRequirements);
      const txHash = result.transaction ? String(result.transaction) : null;
      if (result.success) {
        upsertSettlement(config.databasePath, {
          payment_key: paymentKey,
          status: "success",
          tx_hash: txHash,
          error_reason: null,
          ...meta,
        });
        settleCounters.settleSuccess.inc();
        return { ...result, opsilot: { paymentKey } };
      }

      const reason = String(result.errorReason ?? result.errorMessage ?? "settle_failed");
      if (reason === "settlement_pending" || txHash) {
        upsertSettlement(config.databasePath, {
          payment_key: paymentKey,
          status: "pending",
          tx_hash: txHash,
          error_reason: reason,
          ...meta,
        });
        settleCounters.settlePending.inc();
        return {
          success: false,
          errorReason: "settlement_pending",
          transaction: txHash,
          network: meta.network,
          opsilot: { paymentKey },
        };
      }

      upsertSettlement(config.databasePath, {
        payment_key: paymentKey,
        status: "failed",
        tx_hash: txHash,
        error_reason: reason,
        ...meta,
      });
      settleCounters.settleFailed.inc();
      return { ...result, opsilot: { paymentKey } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      upsertSettlement(config.databasePath, {
        payment_key: paymentKey,
        status: "failed",
        tx_hash: null,
        error_reason: message,
        ...meta,
      });
      settleCounters.settleFailed.inc();
      throw error;
    }
  });
}
