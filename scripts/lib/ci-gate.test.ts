import { describe, expect, it } from "vitest";
import { type GateStep, type GateTools, runGate } from "./ci-gate";

const STEPS: readonly GateStep[] = [
  { label: "lint", args: ["run", "lint"] },
  { label: "test", args: ["run", "test"] },
];

interface FakeState {
  readonly written: Map<string, string>;
  readonly removed: string[];
  readonly ran: string[];
}

function createFakeTools(options: {
  isRepository?: boolean;
  isDirty?: boolean;
  failingStep?: string;
}): { tools: GateTools; state: FakeState } {
  const state: FakeState = { written: new Map(), removed: [], ran: [] };
  const isRepository = options.isRepository ?? true;

  const tools: GateTools = {
    git: async (args) => {
      if (!isRepository) return { ok: false, stdout: "" };

      if (args[0] === "status") {
        return { ok: true, stdout: options.isDirty ? " M file.ts\n" : "" };
      }

      if (args.includes("--show-toplevel"))
        return { ok: true, stdout: "/repo\n" };

      return { ok: true, stdout: "abc1234def\n" };
    },
    runNpm: async (args) => {
      state.ran.push(args.join(" "));

      return args.at(-1) !== options.failingStep;
    },
    removeFile: async (path) => {
      state.removed.push(path);
    },
    writeFile: async (path, content) => {
      state.written.set(path, content);
    },
    log: () => {},
    error: () => {},
  };

  return { tools, state };
}

describe("runGate", () => {
  it("deve gravar o commit aprovado quando todos os passos passam", async () => {
    const { tools, state } = createFakeTools({});

    const exitCode = await runGate(STEPS, tools);

    expect(exitCode).toBe(0);
    expect([...state.written.values()]).toEqual(["abc1234def\n"]);
  });

  it("deve recusar quando há mudança sem commit, sem rodar nenhum passo", async () => {
    const { tools, state } = createFakeTools({ isDirty: true });

    const exitCode = await runGate(STEPS, tools);

    expect(exitCode).toBe(1);
    expect(state.ran).toEqual([]);
    expect(state.written.size).toBe(0);
  });

  it("deve parar no primeiro passo que falha e não aprovar", async () => {
    const { tools, state } = createFakeTools({ failingStep: "lint" });

    const exitCode = await runGate(STEPS, tools);

    expect(exitCode).toBe(1);
    expect(state.ran).toEqual(["run lint"]);
    expect(state.written.size).toBe(0);
  });

  it("deve apagar a aprovação antiga antes de começar", async () => {
    const { tools, state } = createFakeTools({ failingStep: "test" });

    await runGate(STEPS, tools);

    expect(state.removed).toHaveLength(1);
    expect(state.removed[0]).toContain("ci-ok");
  });

  it("deve recusar fora de um repositório git", async () => {
    const { tools } = createFakeTools({ isRepository: false });

    const exitCode = await runGate(STEPS, tools);

    expect(exitCode).toBe(1);
  });
});
