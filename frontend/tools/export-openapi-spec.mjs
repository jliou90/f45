import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const frontendRoot = process.cwd();
const backendRoot = path.resolve(frontendRoot, "../backend");

const isWin = process.platform === "win32";
const candidates = isWin
  ? [path.join(backendRoot, ".venv", "Scripts", "python.exe"), path.join(backendRoot, ".venv", "Scripts", "python"), "python"]
  : [path.join(backendRoot, ".venv", "bin", "python"), "python3", "python"];

const scriptPath = path.join(backendRoot, "tools", "export_openapi.py");
const outPath = path.join(frontendRoot, "src", "api", "openapi.json");

let lastError = "";

for (const pythonCmd of candidates) {
  const result = spawnSync(pythonCmd, [scriptPath, "--out", outPath], {
    cwd: frontendRoot,
    stdio: "inherit",
    shell: false,
  });

  if (result.status === 0) {
    process.exit(0);
  }
  if (result.error) {
    lastError = String(result.error.message || result.error);
    continue;
  }
  lastError = `process exited ${result.status ?? "unknown"} using ${pythonCmd}`;
}

console.error(`OpenAPI export failed. ${lastError}`);
process.exit(1);
