/**
 * Find a working Python executable (local venv first, then Windows `py` launcher — avoids broken pip.exe shims).
 * @returns {string | null} Absolute path to python.exe
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Optional: full path to python.exe when PATH is not updated yet (e.g. new install, old terminal). */
function runOut(cmd, args) {
  /**
   * Never use shell:true on Windows here: cmd.exe treats `;` inside Python's `-c` snippet as a
   * statement separator, so `import sys; print(...)` breaks and Python is never detected.
   */
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: false,
  });
  if (r.status !== 0 || !r.stdout) return null;
  const line = r.stdout
    .trim()
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .pop();
  return line || null;
}

/** Optional: full path to python.exe when PATH is not updated yet (e.g. new install, old terminal). */
function resolveFromEnvOverride() {
  const raw = process.env.FLEETOPS_PYTHON?.trim() || process.env.PYTHON?.trim();
  if (!raw) return null;
  if (!fs.existsSync(raw)) return null;
  const out = runOut(raw, ["-c", "import sys; print(sys.executable)"]);
  if (out && fs.existsSync(out)) return out;
  return null;
}

/** Windows: try every `python.exe` on PATH until one runs. */
function resolveFromWherePython() {
  if (process.platform !== "win32") return null;
  const r = spawnSync("where.exe", ["python"], { encoding: "utf8", shell: false });
  if (r.status !== 0 || !r.stdout) return null;
  const lines = r.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => /\.exe$/i.test(s));
  for (const candidate of lines) {
    const out = runOut(candidate, ["-c", "import sys; print(sys.executable)"]);
    if (out && fs.existsSync(out)) return out;
  }
  return null;
}

/**
 * Microsoft Store / python.org installers often put binaries under LocalAppData\Programs\Python
 * before a new shell picks up PATH.
 */
function scanWindowsInstallFolders() {
  if (process.platform !== "win32") return null;
  const local =
    process.env.LOCALAPPDATA || path.join(homedir(), "AppData", "Local");
  const roots = [
    path.join(local, "Programs", "Python"),
    path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Python"),
  ];
  const exes = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const candidate = path.join(root, ent.name, "python.exe");
      if (fs.existsSync(candidate)) exes.push(candidate);
    }
  }
  const pf = process.env["ProgramFiles"] || "C:\\Program Files";
  try {
    for (const ent of fs.readdirSync(pf, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      if (!/^Python\d/i.test(ent.name)) continue;
      const candidate = path.join(pf, ent.name, "python.exe");
      if (fs.existsSync(candidate)) exes.push(candidate);
    }
  } catch {
    /* ignore */
  }
  exes.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const exe of exes) {
    const out = runOut(exe, ["-c", "import sys; print(sys.executable)"]);
    if (out && fs.existsSync(out)) return out;
  }
  return null;
}

export function resolvePythonExecutable() {
  const fromEnv = resolveFromEnvOverride();
  if (fromEnv) return fromEnv;

  const venvCandidates = [
    path.join(repoRoot, "backend", ".venv", "Scripts", "python.exe"),
    path.join(repoRoot, "backend", ".venv", "bin", "python"),
  ];
  for (const p of venvCandidates) {
    if (fs.existsSync(p)) return p;
  }

  const fromFolders = scanWindowsInstallFolders();
  if (fromFolders) return fromFolders;

  /** Prefer pinned minor on Windows (py launcher). */
  const tries = [
    ["py", ["-3.12", "-c", "import sys; print(sys.executable)"]],
    ["py", ["-3.13", "-c", "import sys; print(sys.executable)"]],
    ["py", ["-3.14", "-c", "import sys; print(sys.executable)"]],
    ["py", ["-3", "-c", "import sys; print(sys.executable)"]],
    ["py", ["-c", "import sys; print(sys.executable)"]],
    ["python", ["-c", "import sys; print(sys.executable)"]],
    ["python3", ["-c", "import sys; print(sys.executable)"]],
  ];
  for (const [cmd, args] of tries) {
    const out = runOut(cmd, args);
    if (out && fs.existsSync(out)) return out;
  }
  const fromWhere = resolveFromWherePython();
  if (fromWhere) return fromWhere;
  return null;
}
