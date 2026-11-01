import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

/** Folders the Dockerfile copies from the builder; each must exist in a clean clone. */
async function copiedFolders(): Promise<string[]> {
  const dockerfile = await readFile("Dockerfile", "utf8");
  const matches = dockerfile.matchAll(
    /COPY --from=builder (?:--\S+ )*\/app\/(\w+) /g,
  );

  return [...matches]
    .map((match) => match[1])
    .filter((folder): folder is string => folder != null);
}

const ALWAYS_SKIPPED = new Set(["node_modules", ".next", ".git"]);
const SOURCE_FILE = /\.(ts|tsx|mts|mjs)$/;
const RELATIVE_IMPORT = /from\s+["'](\.{1,2}\/[^"']+)["']/g;

/** The plain entries of .dockerignore (no patterns or exceptions), as top-level paths. */
async function ignoredPaths(): Promise<Set<string>> {
  const content = await readFile(".dockerignore", "utf8");

  return new Set(
    content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !/[*!#]/.test(line)),
  );
}

function isIgnored(relativePath: string, ignored: Set<string>): boolean {
  const normalized = relativePath.split(path.sep).join("/");
  const topLevel = normalized.split("/")[0] ?? "";

  return ignored.has(normalized) || ignored.has(topLevel);
}

/** Source files that go into the image (the build type-checks all of them). */
async function filesInImage(ignored: Set<string>): Promise<string[]> {
  // Skipped folders are never walked: node_modules and .next alone took the test past its time
  // limit on a busy machine.
  const topLevelEntries = await readdir(".", { withFileTypes: true });
  const files: string[] = [];

  for (const entry of topLevelEntries) {
    if (ALWAYS_SKIPPED.has(entry.name)) continue;

    if (entry.isDirectory() === false) {
      files.push(entry.name);
      continue;
    }

    const nested = await readdir(entry.name, { recursive: true });
    files.push(...nested.map((name) => path.join(entry.name, name)));
  }

  return files.filter(
    (file) => SOURCE_FILE.test(file) && isIgnored(file, ignored) === false,
  );
}

describe("contexto do Docker", () => {
  it("deve ter no git cada pasta que o Dockerfile copia, para o build funcionar num clone limpo", async () => {
    const folders = await copiedFolders();

    for (const folder of folders) {
      const { stdout } = await execFileAsync("git", ["ls-files", folder]);

      expect(stdout.trim(), `pasta ${folder} sem arquivo no git`).not.toBe("");
    }

    expect(folders).toContain("public");
  });

  it("nenhum arquivo da imagem deve importar algo que o .dockerignore deixa de fora", async () => {
    // The build type-checks every file it gets; an import of a left-out file breaks it only on
    // the server (playwright.config.ts importing e2e/, 23/10/2026).
    const ignored = await ignoredPaths();
    const broken: string[] = [];

    for (const file of await filesInImage(ignored)) {
      const source = await readFile(file, "utf8");

      for (const match of source.matchAll(RELATIVE_IMPORT)) {
        const target = path.normalize(
          path.join(path.dirname(file), match[1] ?? ""),
        );

        if (isIgnored(target, ignored)) broken.push(`${file} -> ${match[1]}`);
      }
    }

    expect(broken).toEqual([]);
  });
});
