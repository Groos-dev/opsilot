import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { loadConfig } from "@/lib/config";
import { getFacilitatorBundle } from "@/lib/facilitator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    paymentPayload: PaymentPayload;
    paymentRequirements: PaymentRequirements;
  };
  const config = loadConfig();
  const { facilitator } = getFacilitatorBundle(config);
  const result = await facilitator.verify(body.paymentPayload, body.paymentRequirements);
  return Response.json(result);
}
