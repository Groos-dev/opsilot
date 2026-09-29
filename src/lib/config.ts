export type AppConfig = {
  port: number;
  network: string;
  chainId: number | null;
  rpcUrl: string;
  settlementPrivateKey: `0x${string}`;
  opsApiToken: string;
  databasePath: string;
  /** Native gas-token alert threshold (in whole units of NATIVE_SYMBOL). */
  gasAlertThreshold: number;
  nativeSymbol: string;
  explorerBaseUrl: string | null;
  explorerTxUrlTemplate: string | null;
  mockAsset: `0x${string}` | null;
  confirmationTimeoutMs: number;
  mockData: boolean;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing env ${name}`);
  return value;
}

function optional(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function truthy(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function loadConfig(): AppConfig {
  const key = required("SETTLEMENT_PRIVATE_KEY");
  const settlementPrivateKey = (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
  const chainIdRaw = optional("CHAIN_ID");
  const mockAsset = optional("MOCK_ASSET");
  const gasThreshold =
    process.env.GAS_ALERT_THRESHOLD?.trim() ||
    process.env.GAS_ALERT_THRESHOLD_AVAX?.trim() ||
    "0.05";

  return {
    port: Number(process.env.PORT ?? 4030),
    network: process.env.NETWORK?.trim() || "eip155:43113",
    chainId: chainIdRaw ? Number(chainIdRaw) : null,
    rpcUrl: required("RPC_URL"),
    settlementPrivateKey,
    opsApiToken: required("OPS_API_TOKEN"),
    databasePath: process.env.DATABASE_PATH?.trim() || "./data/opsilot.sqlite",
    gasAlertThreshold: Number(gasThreshold),
    nativeSymbol: process.env.NATIVE_SYMBOL?.trim() || "ETH",
    explorerBaseUrl: optional("EXPLORER_BASE_URL"),
    explorerTxUrlTemplate: optional("EXPLORER_TX_URL"),
    mockAsset: mockAsset
      ? ((mockAsset.startsWith("0x") ? mockAsset : `0x${mockAsset}`) as `0x${string}`)
      : null,
    confirmationTimeoutMs: Number(process.env.CONFIRMATION_TIMEOUT_MS ?? 60_000),
    mockData: truthy(process.env.MOCK_DATA, true),
  };
}
