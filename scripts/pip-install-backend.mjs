#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePythonExecutable } from "./resolve-python.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const req = path.join(root, "backend", "requirements.txt");
const exe = resolvePythonExecutable();

if (!exe) {
  console.error(
    "FleetOpt: No working Python found.\n" +
      "  • Close this terminal, open a new one (or restart Cursor) so PATH updates after install.\n" +
      "  • Or set FLEETOPS_PYTHON to the full path of python.exe, e.g.:\n" +
      '      $env:FLEETOPS_PYTHON = "$env:LOCALAPPDATA\\Programs\\Python\\Python314\\python.exe"\n' +
      "  • Then run: npm run setup\n" +
      "  • Install help: https://www.python.org/downloads/windows/",
  );
  process.exit(1);
}

console.log(`FleetOpt: using Python: ${exe}`);
const r = spawnSync(exe, ["-m", "pip", "install", "-r", req], {
  cwd: root,
  stdio: "inherit",
});
process.exit(r.status === null ? 1 : r.status);
