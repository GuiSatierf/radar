import { join } from "node:path";

/**
 * Runs locally what the GitHub CI runs and, when every step passes, writes the approved commit
 * hash to `<repo root>/.claude/ci-ok`. The global push hook only allows `git push` and
 * `gh pr create` when that file matches the current HEAD.
 */

/** One npm command; the label shows in the output and in the failure message. */
export interface GateStep {
  readonly label: string;
  readonly args: readonly string[];
}

/**
 * Same steps and order as .github/workflows/ci.yml: lockfile sync first (the error `npm ci` would
 * give, without reinstalling) and the production dependency audit last. Offline, the audit fails
 * and nothing is approved.
 */
export const GATE_STEPS: readonly GateStep[] = [
  {
    label: "lockfile",
    args: ["ci", "--dry-run", "--ignore-scripts", "--no-audit", "--no-fund"],
  },
  { label: "format:check", args: ["run", "format:check"] },
  { label: "lint", args: ["run", "lint"] },
  { label: "typecheck", args: ["run", "typecheck"] },
  { label: "test", args: ["run", "test"] },
  { label: "build", args: ["run", "build"] },
  { label: "audit", args: ["audit", "--omit=dev", "--audit-level=high"] },
];

/** Everything the gate needs from outside; tests swap in fakes. */
export interface GateTools {
  git(args: readonly string[]): Promise<{ ok: boolean; stdout: string }>;
  runNpm(args: readonly string[], cwd: string): Promise<boolean>;
  removeFile(path: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
  log(message: string): void;
  error(message: string): void;
}

async function gitLine(
  tools: GateTools,
  args: readonly string[],
): Promise<string | null> {
  const result = await tools.git(args);

  if (!result.ok) return null;

  const line = result.stdout.trim();

  return line.length === 0 ? null : line;
}

/** A tracked file with uncommitted changes; untracked drafts do not count, like the push hook. */
async function hasTrackedChanges(tools: GateTools): Promise<boolean> {
  const status = await tools.git([
    "status",
    "--porcelain",
    "--untracked-files=no",
  ]);

  return status.stdout.trim().length > 0;
}

async function runSteps(
  steps: readonly GateStep[],
  tools: GateTools,
  root: string,
): Promise<GateStep | null> {
  for (const step of steps) {
    tools.log(`\n=== ci: ${step.label} ===`);

    const passed = await tools.runNpm(step.args, root);

    if (!passed) return step;
  }

  return null;
}

/** Resolves with the exit code: 0 approved, 1 refused. The old approval is removed first. */
export async function runGate(
  steps: readonly GateStep[],
  tools: GateTools,
): Promise<number> {
  const root = await gitLine(tools, ["rev-parse", "--show-toplevel"]);
  const head = await gitLine(tools, ["rev-parse", "HEAD"]);

  if (root == null || head == null) {
    tools.error("ci: this folder is not a git repository.");
    return 1;
  }

  const approvalFile = join(root, ".claude", "ci-ok");
  await tools.removeFile(approvalFile);

  if (await hasTrackedChanges(tools)) {
    tools.error(
      "ci: there are uncommitted changes. Commit first, so the approved hash is the one that ships.",
    );
    return 1;
  }

  const failed = await runSteps(steps, tools, root);

  if (failed != null) {
    tools.error(`\nci: "${failed.label}" failed. Nothing was approved.`);
    return 1;
  }

  await tools.writeFile(approvalFile, `${head}\n`);
  tools.log(
    `\nci: all steps passed. Commit ${head.slice(0, 7)} approved for push.`,
  );

  return 0;
}
