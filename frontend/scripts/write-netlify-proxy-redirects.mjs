/**
 * Netlify edge proxy for /api-proxy and /uploads.
 * Next.js rewrites can fall back to localhost when BACKEND_ORIGIN is missing at build time;
 * these redirects are generated during `npm run build` from the same env var.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(frontendRoot, "public");
const backendOrigin = (process.env.BACKEND_ORIGIN || "").trim().replace(/\/+$/, "");

if (!backendOrigin) {
  console.log("write-netlify-proxy-redirects: BACKEND_ORIGIN not set; skipping public/_redirects");
  process.exit(0);
}

if (process.env.NODE_ENV === "production" && !backendOrigin.startsWith("https://")) {
  throw new Error(
    "BACKEND_ORIGIN must be an HTTPS URL in production (e.g. https://your-service.up.railway.app).",
  );
}

fs.mkdirSync(publicDir, { recursive: true });
const redirects = [
  `/api-proxy/*  ${backendOrigin}/api/:splat  200`,
  `/uploads/*  ${backendOrigin}/uploads/:splat  200`,
  "",
].join("\n");

fs.writeFileSync(path.join(publicDir, "_redirects"), redirects, "utf8");
console.log(`write-netlify-proxy-redirects: wrote proxy rules for ${backendOrigin}`);
