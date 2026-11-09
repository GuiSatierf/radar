import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const collectAdsAndRecordMock = vi.fn();
const selectAdSourceMock = vi.fn();
const SUPPLIER_SOURCE = { name: "fornecedor", fetchAds: async () => [] };

vi.mock("@/db/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/sources/ads/select-ad-source", () => ({
  selectAdSource: selectAdSourceMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/sources/ads/collect-ads", () => ({
  collectAdsAndRecord: collectAdsAndRecordMock,
}));

const SECRET = "segredo-da-coleta-com-tamanho-bom";

function post(authorization?: string): Request {
  const headers = new Headers();

  if (authorization != null) headers.set("authorization", authorization);

  return new Request("http://localhost/api/cron/collect-ads", {
    method: "POST",
    headers,
  });
}

describe("POST /api/cron/collect-ads", () => {
  beforeEach(() => {
    collectAdsAndRecordMock.mockReset();
    selectAdSourceMock.mockReset();
    selectAdSourceMock.mockReturnValue(SUPPLIER_SOURCE);
    collectAdsAndRecordMock.mockResolvedValue({
      saved: 7,
      skipped: 0,
      stopped: 1,
      stopSkipped: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("não deve existir sem CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { POST } = await import("./route");

    const response = await POST(post(`Bearer ${SECRET}`));

    expect(response.status).toBe(404);
    expect(collectAdsAndRecordMock).not.toHaveBeenCalled();
  });

  it("deve recusar sem o segredo certo", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const { POST } = await import("./route");

    const response = await POST(post("Bearer outro-segredo"));

    expect(response.status).toBe(401);
    expect(collectAdsAndRecordMock).not.toHaveBeenCalled();
  });

  it("deve coletar com o segredo certo e devolver o resumo", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const { POST } = await import("./route");

    const response = await POST(post(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ saved: 7, stopped: 1 });
    expect(collectAdsAndRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: SUPPLIER_SOURCE }),
    );
  });

  it("não deve gravar anúncio nenhum quando não há fonte automática de verdade", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    selectAdSourceMock.mockReturnValue(null);
    const { POST } = await import("./route");

    const response = await POST(post(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "no-source" });
    expect(collectAdsAndRecordMock).not.toHaveBeenCalled();
  });

  it("deve responder 500 sem detalhes quando a coleta falha", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    collectAdsAndRecordMock.mockRejectedValue(new Error("fonte fora do ar"));
    const { POST } = await import("./route");

    const response = await POST(post(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("fonte fora do ar");
  });
});
