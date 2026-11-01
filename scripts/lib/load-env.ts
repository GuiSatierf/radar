import { loadEnvFileIfPresent } from "./file-exists";

export async function loadLocalEnv(): Promise<void> {
  await loadEnvFileIfPresent();
}

export class MissingVariableError extends Error {
  constructor(name: string) {
    super(`Missing environment variable ${name}. Run "npm run setup" first.`);
    this.name = "MissingVariableError";
  }
}

export function requireVariable(name: string): string {
  const value = process.env[name];

  if (value == null || value.trim().length === 0) {
    throw new MissingVariableError(name);
  }

  return value;
}
