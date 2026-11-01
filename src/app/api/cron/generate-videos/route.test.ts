import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runVideoQueueMock = vi.fn();

vi.mock("@/features/studio/run-queue", () => ({
  runVideoQueue: runVideoQueueMock,
}));

const SECRET = "segredo-da-fila-com-tamanho-bom";

function post(authorization?: string): Request {
  const headers = new Headers();

  if (authorization != null) headers.set("authorization", authorization);

  return new Request("http://localhost/api/cron/generate-videos", {
    method: "POST",
    headers,
  });
}

describe("POST /api/cron/generate-videos", () => {
  beforeEach(() => {
    runVideoQueueMock.mockReset();
    runVideoQueueMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("não deve existir sem CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { POST } = await import("./route");

    const response = await POST(post(`Bearer ${SECRET}`));

    expect(response.status).toBe(404);
    expect(runVideoQueueMock).not.toHaveBeenCalled();
  });

  it("deve recusar sem o segredo certo", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const { POST } = await import("./route");

    const response = await POST(post("Bearer outro-segredo"));

    expect(response.status).toBe(401);
    expect(runVideoQueueMock).not.toHaveBeenCalled();
  });

  it("deve rodar a fila com o segredo certo", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const { POST } = await import("./route");

    const response = await POST(post(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(runVideoQueueMock).toHaveBeenCalledOnce();
  });

  it("deve responder 500 quando a fila falha", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    runVideoQueueMock.mockResolvedValue(false);
    const { POST } = await import("./route");

    const response = await POST(post(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
  });
});
