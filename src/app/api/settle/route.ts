import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { settleWithOps } from "@/lib/settle";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    paymentPayload: PaymentPayload;
    paymentRequirements: PaymentRequirements;
  };
  try {
    const result = await settleWithOps(body);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ success: false, errorReason: message }, { status: 500 });
  }
}
