import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const getDatabaseMock = vi.fn();
const banUserMock = vi.fn();
const unbanUserMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/db/client", () => ({ getDatabase: getDatabaseMock }));
vi.mock("@/lib/auth", () => ({
  getAuth: () => ({
    api: { banUser: banUserMock, unbanUser: unbanUserMock },
  }),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { changeUserPlan, setUserBlocked } = await import("./actions");

/** A database whose update and select both answer with the given rows. */
function fakeDatabase(rows: unknown[]) {
  const chain = {
    set: () => chain,
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
    returning: async () => rows,
  };
  const db = { update: vi.fn(() => chain), select: vi.fn(() => chain) };
  getDatabaseMock.mockReturnValue(db);

  return db;
}

const subscriber = { id: "u1", isAdmin: false };
const admin = { id: "a1", isAdmin: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("quem não é admin", () => {
  it("não deve conseguir trocar plano, nem chamando a ação direto", async () => {
    getCurrentUserMock.mockResolvedValue(subscriber);
    const db = fakeDatabase([{ id: "u1" }]);

    const result = await changeUserPlan({ userId: "u1", plan: "pro" });

    expect(result.ok).toBe(false);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("não deve conseguir bloquear ninguém, nem sem estar logado", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    fakeDatabase([{ id: "u2", role: "user" }]);

    const result = await setUserBlocked({ userId: "u2", blocked: true });

    expect(result.ok).toBe(false);
    expect(banUserMock).not.toHaveBeenCalled();
  });
});

describe("admin", () => {
  beforeEach(() => {
    getCurrentUserMock.mockResolvedValue(admin);
  });

  it("deve trocar o plano para um que existe", async () => {
    const db = fakeDatabase([{ id: "u1" }]);

    const result = await changeUserPlan({ userId: "u1", plan: "completo" });

    expect(result).toEqual({ ok: true });
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it("deve recusar um plano que não existe", async () => {
    const db = fakeDatabase([{ id: "u1" }]);

    const result = await changeUserPlan({ userId: "u1", plan: "ouro" });

    expect(result.ok).toBe(false);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("deve avisar quando a conta não existe mais", async () => {
    fakeDatabase([]);

    const result = await changeUserPlan({ userId: "sumiu", plan: "pro" });

    expect(result).toMatchObject({ ok: false, message: /não existe/ });
  });

  it("deve bloquear e desbloquear pelo plugin, que encerra as sessões", async () => {
    fakeDatabase([{ id: "u2", role: "user" }]);

    await setUserBlocked({ userId: "u2", blocked: true });
    await setUserBlocked({ userId: "u2", blocked: false });

    expect(banUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: "u2" } }),
    );
    expect(unbanUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: "u2" } }),
    );
  });

  it("não deve bloquear outra conta de admin", async () => {
    fakeDatabase([{ id: "a2", role: "admin" }]);

    const result = await setUserBlocked({ userId: "a2", blocked: true });

    expect(result.ok).toBe(false);
    expect(banUserMock).not.toHaveBeenCalled();
  });
});
