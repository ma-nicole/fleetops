import type { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const suffix = (path || []).join("/");
  return proxyToBackend(req, `/uploads/${suffix}`);
}

export const GET = handle;
export const HEAD = handle;
export const OPTIONS = handle;
