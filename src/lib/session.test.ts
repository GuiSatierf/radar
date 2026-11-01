import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthMock = vi.fn();
const headersMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }));

class DynamicRenderingSignal extends Error {}

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthMock.mockReset();
    headersMock.mockReset();
  });

  it("deve ler os headers antes de criar o login, para o build não precisar das variáveis", async () => {
    // During `next build`, headers() interrupts static rendering; nothing after it may run.
    headersMock.mockRejectedValue(new DynamicRenderingSignal());
    const { getCurrentUser } = await import("./session");

    await expect(getCurrentUser()).rejects.toBeInstanceOf(
      DynamicRenderingSignal,
    );
    expect(getAuthMock).not.toHaveBeenCalled();
  });

  it("deve devolver só os campos usados, com perfil inválido trocado pelo padrão 3%", async () => {
    headersMock.mockResolvedValue(new Headers());
    getAuthMock.mockReturnValue({
      api: {
        getSession: async () => ({
          user: {
            id: "u1",
            name: "Maria",
            email: "m@e.test",
            image: null,
            commissionProfile: 99,
          },
        }),
      },
    });
    const { getCurrentUser } = await import("./session");

    expect(await getCurrentUser()).toEqual({
      id: "u1",
      name: "Maria",
      email: "m@e.test",
      commissionProfile: 3,
      plan: "none",
      isAdmin: false,
    });
  });

  it("deve trocar plano desconhecido por sem plano e reconhecer o admin pelo papel", async () => {
    headersMock.mockResolvedValue(new Headers());
    getAuthMock.mockReturnValue({
      api: {
        getSession: async () => ({
          user: {
            id: "u2",
            name: "Ana",
            email: "a@e.test",
            commissionProfile: 4,
            plan: "ouro",
            role: "admin",
          },
        }),
      },
    });
    const { getCurrentUser } = await import("./session");

    const user = await getCurrentUser();

    expect(user?.plan).toBe("none");
    expect(user?.isAdmin).toBe(true);
  });

  it("não deve tratar outro papel como admin", async () => {
    headersMock.mockResolvedValue(new Headers());
    getAuthMock.mockReturnValue({
      api: {
        getSession: async () => ({
          user: {
            id: "u3",
            name: "Bia",
            email: "b@e.test",
            commissionProfile: 3,
            plan: "pro",
            role: "user",
          },
        }),
      },
    });
    const { getCurrentUser } = await import("./session");

    const user = await getCurrentUser();

    expect(user?.plan).toBe("pro");
    expect(user?.isAdmin).toBe(false);
  });
});
