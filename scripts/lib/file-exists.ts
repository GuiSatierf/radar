import { access } from "node:fs/promises";

/** True when the file exists; any error other than "not found" is rethrown. */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return false;

    throw error;
  }
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Scripts and test runners live outside Next.js, so they load .env themselves. */
export async function loadEnvFileIfPresent(path = ".env"): Promise<void> {
  if (!(await fileExists(path))) return;

  process.loadEnvFile(path);
}
