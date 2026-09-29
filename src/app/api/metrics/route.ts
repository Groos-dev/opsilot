import { registry } from "@/lib/metrics";

export const runtime = "nodejs";

export async function GET() {
  const body = await registry.metrics();
  return new Response(body, {
    headers: { "content-type": registry.contentType },
  });
}
