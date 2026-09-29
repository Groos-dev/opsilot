import { NextRequest } from "next/server";
import { loadConfig } from "./config";

export function assertOpsAuth(request: NextRequest): Response | null {
  const config = loadConfig();
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token !== config.opsApiToken) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
