import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type SettlementStatus = "success" | "pending" | "failed";

export type SettlementRow = {
  payment_key: string;
  status: SettlementStatus;
  tx_hash: string | null;
  network: string;
  asset: string;
  amount: string;
  pay_to: string;
  error_reason: string | null;
  created_at: string;
  updated_at: string;
};

let databases = new Map<string, Database.Database>();

export function getDb(databasePath: string): Database.Database {
  const resolved = path.resolve(databasePath);
  const existing = databases.get(resolved);
  if (existing) return existing;
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const opened = new Database(resolved);
  opened.exec(`
    CREATE TABLE IF NOT EXISTS settlements (
      payment_key TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      tx_hash TEXT,
      network TEXT NOT NULL,
      asset TEXT NOT NULL,
      amount TEXT NOT NULL,
      pay_to TEXT NOT NULL,
      error_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
    CREATE INDEX IF NOT EXISTS idx_settlements_updated ON settlements(updated_at DESC);
  `);
  databases.set(resolved, opened);
  return opened;
}

export function getSettlement(databasePath: string, paymentKey: string): SettlementRow | undefined {
  return getDb(databasePath)
    .prepare("SELECT * FROM settlements WHERE payment_key = ?")
    .get(paymentKey) as SettlementRow | undefined;
}

export function listSettlements(databasePath: string, limit = 50): SettlementRow[] {
  return getDb(databasePath)
    .prepare("SELECT * FROM settlements ORDER BY updated_at DESC LIMIT ?")
    .all(limit) as SettlementRow[];
}

export function upsertSettlement(
  databasePath: string,
  row: Omit<SettlementRow, "created_at" | "updated_at"> & { created_at?: string },
): SettlementRow {
  const now = new Date().toISOString();
  const existing = getSettlement(databasePath, row.payment_key);
  const createdAt = existing?.created_at ?? row.created_at ?? now;
  getDb(databasePath)
    .prepare(
      `INSERT INTO settlements (
        payment_key, status, tx_hash, network, asset, amount, pay_to, error_reason, created_at, updated_at
      ) VALUES (
        @payment_key, @status, @tx_hash, @network, @asset, @amount, @pay_to, @error_reason, @created_at, @updated_at
      )
      ON CONFLICT(payment_key) DO UPDATE SET
        status=excluded.status,
        tx_hash=excluded.tx_hash,
        network=excluded.network,
        asset=excluded.asset,
        amount=excluded.amount,
        pay_to=excluded.pay_to,
        error_reason=excluded.error_reason,
        updated_at=excluded.updated_at`,
    )
    .run({
      payment_key: row.payment_key,
      status: row.status,
      tx_hash: row.tx_hash,
      network: row.network,
      asset: row.asset,
      amount: row.amount,
      pay_to: row.pay_to,
      error_reason: row.error_reason,
      created_at: createdAt,
      updated_at: now,
    });
  return getSettlement(databasePath, row.payment_key)!;
}

export function countByStatus(databasePath: string): Record<SettlementStatus, number> {
  const rows = getDb(databasePath)
    .prepare("SELECT status, COUNT(*) AS c FROM settlements GROUP BY status")
    .all() as Array<{ status: SettlementStatus; c: number }>;
  const out: Record<SettlementStatus, number> = { success: 0, pending: 0, failed: 0 };
  for (const row of rows) out[row.status] = row.c;
  return out;
}
