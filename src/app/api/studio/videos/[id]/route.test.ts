import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveVideoFile } from "@/features/studio/video-files";

const VIDEO_ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const VIDEO_BYTES = new Uint8Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

const state = vi.hoisted(() => ({
  directory: "",
  isAllowed: true,
  video: { id: "", productName: "Garrafa Térmica" } as {
    id: string;
    productName: string;
  } | null,
}));

vi.mock("@/lib/session", () => ({
  checkToolAccess: async () => ({
    user: { id: "usuario-1" },
    isAllowed: state.isAllowed,
  }),
}));
vi.mock("@/db/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ VIDEO_FILES_DIR: state.directory }),
}));
vi.mock("@/features/studio/queries", () => ({
  findDownloadableVideo: async () => state.video,
}));

const { GET } = await import("./route");

function get(id: string, range?: string): Promise<Response> {
  const headers = new Headers();

  if (range != null) headers.set("range", range);

  return GET(
    new Request(`http://localhost/api/studio/videos/${id}`, { headers }),
    {
      params: Promise.resolve({ id }),
    },
  );
}

describe("GET /api/studio/videos/[id]", () => {
  beforeEach(async () => {
    state.directory = await mkdtemp(path.join(os.tmpdir(), "video-route-"));
    state.isAllowed = true;
    state.video = { id: VIDEO_ID, productName: "Garrafa Térmica" };
    await saveVideoFile(state.directory, VIDEO_ID, VIDEO_BYTES);
  });

  afterEach(async () => {
    await rm(state.directory, { recursive: true, force: true });
  });

  it("deve mandar o vídeo inteiro para a dona", async () => {
    const response = await get(VIDEO_ID);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-length")).toBe("10");
    expect(response.headers.get("content-disposition")).toContain(
      "garrafa-termica.mp4",
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(VIDEO_BYTES);
  });

  it("deve mandar só o pedaço pedido no Range", async () => {
    const response = await get(VIDEO_ID, "bytes=2-4");

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([12, 13, 14]),
    );
  });

  it("deve recusar um Range fora do arquivo", async () => {
    const response = await get(VIDEO_ID, "bytes=50-");

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
  });

  it("deve responder que não achou o vídeo de outra pessoa", async () => {
    state.video = null;

    const response = await get(VIDEO_ID);

    expect(response.status).toBe(404);
  });

  it("deve responder que não achou quando a pessoa não tem acesso ao Studio", async () => {
    state.isAllowed = false;

    const response = await get(VIDEO_ID);

    expect(response.status).toBe(404);
  });

  it("deve responder que não achou um id que não é de vídeo", async () => {
    const response = await get("..%2F..%2Fetc%2Fpasswd");

    expect(response.status).toBe(404);
  });

  it("deve responder que não achou quando o arquivo sumiu", async () => {
    await rm(path.join(state.directory, `${VIDEO_ID}.mp4`));

    const response = await get(VIDEO_ID);

    expect(response.status).toBe(404);
  });
});
