import { Counter, Gauge, Registry, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const settleCounters = {
  settleAttempts: new Counter({
    name: "opsilot_settle_attempts_total",
    help: "Settle attempts",
    registers: [registry],
  }),
  settleSuccess: new Counter({
    name: "opsilot_settle_success_total",
    help: "Successful settles",
    registers: [registry],
  }),
  settleFailed: new Counter({
    name: "opsilot_settle_failed_total",
    help: "Failed settles",
    registers: [registry],
  }),
  settlePending: new Counter({
    name: "opsilot_settle_pending_total",
    help: "Pending settles",
    registers: [registry],
  }),
  idempotentHits: new Counter({
    name: "opsilot_settle_idempotent_hits_total",
    help: "Settle short-circuits from ledger",
    registers: [registry],
  }),
};

export const gasBalanceGauge = new Gauge({
  name: "opsilot_wallet_native_balance",
  help: "Native gas token balance (AVAX)",
  labelNames: ["address"],
  registers: [registry],
});
