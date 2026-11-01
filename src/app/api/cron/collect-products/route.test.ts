import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const collectAndRecordMock = vi.fn();

vi.mock("@/db/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/sources/products/record-collection", () => ({
  collectAndRecord: collectAndRecordMock,
}));

const SECRET = "segredo-da-coleta-com-tamanho-bom";

function post(authorization?: string): Request {
  const headers = new Headers();

  if (authorization != null) headers.set("authorization", authorization);

  return new Request("http://localhost/api/cron/collect-products", {
    method: "POST",
    headers,
  });
}

describe("POST /api/cron/collect-products", () => {
  beforeEach(() => {
    collectAndRecordMock.mockReset();
    collectAndRecordMock.mockResolvedValue({
      saved: 40,
      skipped: 0,
      removed: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("não deve existir sem CRON_SECRET, nem com o cabeçalho certo de outro ambiente", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { POST } = await import("./route");

    const response = await POST(post(`Bearer ${SECRET}`));

    expect(response.status).toBe(404);
    expect(collectAndRecordMock).not.toHaveBeenCalled();
  });

  it("deve recusar sem o segredo certo", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const { POST } = await import("./route");

    const missing = await POST(post());
    const wrong = await POST(post("Bearer outro-segredo"));

    expect([missing.status, wrong.status]).toEqual([401, 401]);
    expect(collectAndRecordMock).not.toHaveBeenCalled();
  });

  it("deve coletar com o segredo certo e devolver o resumo", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const { POST } = await import("./route");

    const response = await POST(post(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      saved: 40,
      skipped: 0,
      removed: 0,
    });
  });

  it("deve aceitar o segredo mesmo com quebra de linha no fim da variável", async () => {
    vi.stubEnv("CRON_SECRET", `${SECRET}\n`);
    const { POST } = await import("./route");

    const response = await POST(post(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
  });

  it("deve responder 500 sem detalhes quando a coleta falha", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    collectAndRecordMock.mockRejectedValue(new Error("fonte fora do ar"));
    const { POST } = await import("./route");

    const response = await POST(post(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("fonte fora do ar");
  });
});
