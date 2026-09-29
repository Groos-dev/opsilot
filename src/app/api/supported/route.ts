import { loadConfig } from "@/lib/config";
import { getFacilitatorBundle } from "@/lib/facilitator";

export const runtime = "nodejs";

export async function GET() {
  const config = loadConfig();
  const { facilitator } = getFacilitatorBundle(config);
  const supported = facilitator.getSupported();
  return Response.json({
    ...supported,
    opsilot: { product: "Opsilot", slogan: "More than settlement" },
  });
}
