import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { paymentKeyFromPayload } from "../src/lib/payment-key.js";
import { getSettlement, upsertSettlement } from "../src/lib/ledger.js";
import { WalletQueue } from "../src/lib/queue.js";

test("payment key is stable for key order", () => {
  const a = paymentKeyFromPayload({ b: 1, a: { y: 2, x: 3 } });
  const b = paymentKeyFromPayload({ a: { x: 3, y: 2 }, b: 1 });
  assert.equal(a, b);
});

test("ledger upserts and reads settlement", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "opsilot-"));
  const dbPath = path.join(dir, "t.sqlite");
  upsertSettlement(dbPath, {
    payment_key: "abc",
    status: "pending",
    tx_hash: "0x1",
    network: "eip155:43113",
    asset: "0xusdc",
    amount: "1000",
    pay_to: "0xpay",
    error_reason: "settlement_pending",
  });
  const row = getSettlement(dbPath, "abc");
  assert.equal(row?.status, "pending");
  upsertSettlement(dbPath, {
    payment_key: "abc",
    status: "success",
    tx_hash: "0x1",
    network: "eip155:43113",
    asset: "0xusdc",
    amount: "1000",
    pay_to: "0xpay",
    error_reason: null,
  });
  assert.equal(getSettlement(dbPath, "abc")?.status, "success");
});

test("wallet queue runs serially", async () => {
  const q = new WalletQueue();
  const order: number[] = [];
  await Promise.all([
    q.enqueue("w", async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push(1);
    }),
    q.enqueue("w", async () => {
      order.push(2);
    }),
  ]);
  assert.deepEqual(order, [1, 2]);
});
