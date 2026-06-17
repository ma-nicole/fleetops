#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freePort } from "./free-port.mjs";
import { resolvePythonExecutable } from "./resolve-python.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const API_PORT = 8000;
const exe = resolvePythonExecutable();

if (!exe) {
  console.error(
    "FleetOpt: No working Python found. Run `npm run install:backend` after fixing Python, or see README.",
  );
  process.exit(1);
}

const freed = freePort(API_PORT);
if (freed > 0) {
  console.warn(`FleetOpt: freed port ${API_PORT} (${freed} stale listener${freed === 1 ? "" : "s"}).`);
}

const args = [
  "-m",
  "uvicorn",
  "app.main:app",
  "--reload",
  "--host",
  "127.0.0.1",
  "--port",
  String(API_PORT),
];
const child = spawn(exe, args, {
  cwd: backend,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    child.kill(sig === "SIGINT" ? "SIGINT" : "SIGTERM");
  });
}
