export type AppConfig = {
  port: number;
  network: string;
  rpcUrl: string;
  settlementPrivateKey: `0x${string}`;
  opsApiToken: string;
  databasePath: string;
  gasAlertThresholdAvax: number;
  confirmationTimeoutMs: number;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing env ${name}`);
  return value;
}

export function loadConfig(): AppConfig {
  const key = required("SETTLEMENT_PRIVATE_KEY");
  const settlementPrivateKey = (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
  return {
    port: Number(process.env.PORT ?? 4030),
    network: process.env.NETWORK?.trim() || "eip155:43113",
    rpcUrl: required("RPC_URL"),
    settlementPrivateKey,
    opsApiToken: required("OPS_API_TOKEN"),
    databasePath: process.env.DATABASE_PATH?.trim() || "./data/opsilot.sqlite",
    gasAlertThresholdAvax: Number(process.env.GAS_ALERT_THRESHOLD_AVAX ?? 0.05),
    confirmationTimeoutMs: Number(process.env.CONFIRMATION_TIMEOUT_MS ?? 60_000),
  };
}
