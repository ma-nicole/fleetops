#!/usr/bin/env node
/**
 * Runs before `npm run dev` in frontend/. Ensures FastAPI is listening so
 * `/api-proxy` rewrites do not return opaque 500 HTML.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function backendOriginFromEnvFiles() {
  for (const name of [".env.development.local", ".env.local", ".env.development"]) {
    const p = path.join(repoRoot, "frontend", name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    const m = text.match(/^\s*BACKEND_ORIGIN\s*=\s*(\S+)/m);
    if (m) return m[1].trim();
  }
  return null;
}

const origin = (
  process.env.BACKEND_ORIGIN ||
  backendOriginFromEnvFiles() ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const url = `${origin}/health`;

async function probe() {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 2500);
  try {
    const res = await fetch(url, { method: "GET", signal: ac.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

const attempts = 6;
const delayMs = 400;

for (let i = 0; i < attempts; i++) {
  if (await probe()) process.exit(0);
  if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
}

console.error(`
FleetOpt: No API at ${url}

Start the backend, then refresh this terminal:
  From repo root:  npm run dev
  API only:        npm run dev:api   (then npm run dev in frontend)

Need MySQL/XAMPP and backend/.env — see backend/.env.example
`);
process.exit(1);
