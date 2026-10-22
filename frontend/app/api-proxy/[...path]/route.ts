import type { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backendProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const suffix = (path || []).join("/");
  return proxyToBackend(req, `/api/${suffix}`);
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
