#!/usr/bin/env node
/**
 * Terminate processes listening on a TCP port (dev-only helper).
 * Prevents multiple stale uvicorn workers on Windows after interrupted `npm run dev`.
 */
import { spawnSync } from "node:child_process";

/**
 * @param {number} port
 * @returns {number} count of processes signalled
 */
export function freePort(port) {
  if (process.platform === "win32") {
    const listed = spawnSync("netstat", ["-ano"], { encoding: "utf8", shell: false });
    if (listed.status !== 0 || !listed.stdout) return 0;

    const pids = new Set();
    for (const line of listed.stdout.split(/\r?\n/)) {
      if (!line.includes(`:${port}`) || !line.includes("LISTENING")) continue;
      const match = line.trim().match(/\s(\d+)\s*$/);
      if (match) pids.add(match[1]);
    }

    let killed = 0;
    for (const pid of pids) {
      const current = spawnSync("tasklist", ["/FI", `PID eq ${pid}`], {
        encoding: "utf8",
        shell: false,
      });
      if (current.status !== 0 || !current.stdout?.includes(pid)) continue;
      const result = spawnSync("taskkill", ["/PID", pid, "/F"], { shell: false });
      if (result.status === 0) killed += 1;
    }
    return killed;
  }

  const listed = spawnSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf8",
    shell: false,
  });
  if (listed.status !== 0 || !listed.stdout?.trim()) return 0;

  let killed = 0;
  for (const pid of listed.stdout.trim().split(/\s+/)) {
    process.kill(Number(pid), "SIGTERM");
    killed += 1;
  }
  return killed;
}
