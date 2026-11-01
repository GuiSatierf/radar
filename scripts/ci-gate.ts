import { execFile, spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { GATE_STEPS, type GateTools, runGate } from "./lib/ci-gate";

const execFileAsync = promisify(execFile);

const nodeTools: GateTools = {
  git: async (args) => {
    try {
      const { stdout } = await execFileAsync("git", [...args]);
      return { ok: true, stdout };
    } catch {
      return { ok: false, stdout: "" };
    }
  },
  runNpm: (args, cwd) =>
    new Promise((resolve, reject) => {
      // Shell so npm resolves to npm.cmd on Windows; the arguments are the fixed GATE_STEPS.
      const child = spawn(["npm", ...args].join(" "), {
        stdio: "inherit",
        shell: true,
        cwd,
      });

      child.once("error", reject);
      child.once("close", (code) => resolve(code === 0));
    }),
  removeFile: (path) => rm(path, { force: true }),
  writeFile: async (path, content) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  },
  log: (message) => console.log(message),
  error: (message) => console.error(message),
};

process.exitCode = await runGate(GATE_STEPS, nodeTools);
