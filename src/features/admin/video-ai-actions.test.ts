import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const saveVideoLimitMock = vi.fn();
const chooseVideoModelMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/db/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/video-ai/settings", () => ({
  saveVideoLimit: saveVideoLimitMock,
  chooseVideoModel: chooseVideoModelMock,
  clearVideoModel: vi.fn(),
  removeVideoKey: vi.fn(),
  saveVideoKey: vi.fn(),
}));

const { chooseVideoAi, saveVideoLimitSettings } = await import(
  "./video-ai-actions"
);

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue({ id: "a1", isAdmin: true });
  chooseVideoModelMock.mockResolvedValue({ ok: true });
});

describe("limite de vídeos", () => {
  it("não deve desligar o Studio quando o campo da quantidade vai vazio", async () => {
    const result = await saveVideoLimitSettings({ count: "", period: "month" });

    expect(result.ok).toBe(false);
    expect(saveVideoLimitMock).not.toHaveBeenCalled();
  });

  it("deve aceitar zero escrito pelo admin", async () => {
    const result = await saveVideoLimitSettings({ count: "0", period: "day" });

    expect(result).toEqual({ ok: true });
    expect(saveVideoLimitMock).toHaveBeenCalledWith(
      expect.anything(),
      { count: 0, period: "day" },
      expect.any(Date),
    );
  });
});

describe("escolha da IA", () => {
  it("não deve aceitar uma opção com partes a mais", async () => {
    const result = await chooseVideoAi({
      choice: "google:gemini-omni-1.2-flash:extra",
    });

    expect(result.ok).toBe(false);
    expect(chooseVideoModelMock).not.toHaveBeenCalled();
  });

  it("deve escolher o modelo da opção da lista", async () => {
    const result = await chooseVideoAi({
      choice: "google:gemini-omni-1.2-flash",
    });

    expect(result).toEqual({ ok: true });
    expect(chooseVideoModelMock).toHaveBeenCalledWith(
      expect.anything(),
      { provider: "google", model: "gemini-omni-1.2-flash" },
      expect.any(Date),
    );
  });
});
