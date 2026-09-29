import { countByStatus, listSettlements } from "./ledger";

export type PilotPriority = {
  severity: "critical" | "warning" | "info";
  topic: "gas" | "pending" | "rpc" | "success_rate" | "queue" | "other";
  evidence: string;
  recommendation: string;
};

export type PilotReport = {
  summary: string;
  priorities: PilotPriority[];
};

export function analyzeOps(input: {
  databasePath: string;
  gasBalanceAvax: number;
  gasAlertThresholdAvax: number;
  rpcOk: boolean;
}): PilotReport {
  const counts = countByStatus(input.databasePath);
  const recent = listSettlements(input.databasePath, 30);
  const priorities: PilotPriority[] = [];

  if (!input.rpcOk) {
    priorities.push({
      severity: "critical",
      topic: "rpc",
      evidence: "RPC health check failed",
      recommendation: "Check RPC_URL connectivity and switch to a backup endpoint if needed.",
    });
  }

  if (input.gasBalanceAvax < input.gasAlertThresholdAvax) {
    priorities.push({
      severity: "critical",
      topic: "gas",
      evidence: `Hot wallet balance ${input.gasBalanceAvax.toFixed(4)} AVAX is below threshold ${input.gasAlertThresholdAvax}`,
      recommendation: "Top up AVAX on the settlement wallet before settles start failing.",
    });
  } else if (input.gasBalanceAvax < input.gasAlertThresholdAvax * 2) {
    priorities.push({
      severity: "warning",
      topic: "gas",
      evidence: `Hot wallet balance ${input.gasBalanceAvax.toFixed(4)} AVAX is approaching the alert threshold`,
      recommendation: "Schedule a gas top-up soon.",
    });
  }

  if (counts.pending > 0) {
    priorities.push({
      severity: "warning",
      topic: "pending",
      evidence: `${counts.pending} settlement(s) are pending`,
      recommendation:
        "Reconcile each pending tx hash on-chain. Do not ask the payer to re-sign until reconcile shows failure.",
    });
  }

  const decided = counts.success + counts.failed;
  if (decided >= 5) {
    const rate = counts.success / decided;
    if (rate < 0.8) {
      priorities.push({
        severity: "warning",
        topic: "success_rate",
        evidence: `Recent success rate ${(rate * 100).toFixed(1)}% (${counts.success}/${decided})`,
        recommendation: "Inspect failed error_reason values and RPC / asset configuration.",
      });
    }
  }

  const latestFail = recent.find((r) => r.status === "failed");
  if (latestFail?.error_reason) {
    priorities.push({
      severity: "info",
      topic: "other",
      evidence: `Latest failure: ${latestFail.error_reason}`,
      recommendation: "Confirm whether this is a payer-side signature issue or facilitator config issue.",
    });
  }

  if (priorities.length === 0) {
    priorities.push({
      severity: "info",
      topic: "other",
      evidence: "No critical ops signals",
      recommendation: "Continue monitoring gas balance and pending count.",
    });
  }

  const summary =
    priorities[0].severity === "critical"
      ? `Opsilot Pilot: handle ${priorities[0].topic} first — ${priorities[0].evidence}`
      : `Opsilot Pilot: settlement path looks stable; top signal is ${priorities[0].topic}.`;

  return { summary, priorities };
}
