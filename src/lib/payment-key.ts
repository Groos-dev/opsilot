import { createHash } from "node:crypto";

/** Stable idempotency key for a payment payload (authorization uniqueness). */
export function paymentKeyFromPayload(paymentPayload: unknown): string {
  const normalized = canonicalize(paymentPayload);
  return createHash("sha256").update(normalized).digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}
