import { spawn } from "node:child_process";

/**
 * Runs a command with inherited output and resolves with its exit code.
 * Uses a shell so `npm` resolves to npm.cmd on Windows; callers pass only fixed arguments.
 */
export function runCommand(
  command: string,
  args: readonly string[],
): Promise<number> {
  return new Promise((resolve, reject) => {
    const commandLine = [command, ...args].join(" ");
    const child = spawn(commandLine, { stdio: "inherit", shell: true });

    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
}

export async function runCommandOrThrow(
  command: string,
  args: readonly string[],
): Promise<void> {
  const exitCode = await runCommand(command, args);

  if (exitCode === 0) return;

  throw new CommandFailedError(`${command} ${args.join(" ")}`, exitCode);
}

export class CommandFailedError extends Error {
  constructor(commandLine: string, exitCode: number) {
    super(`"${commandLine}" failed with exit code ${exitCode}`);
    this.name = "CommandFailedError";
  }
}
