import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const saveAffiliateCountsMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/db/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/sources/products/affiliate-counts/save-affiliate-counts", () => ({
  saveAffiliateCounts: saveAffiliateCountsMock,
}));

const { importAffiliateCounts } = await import("./affiliate-actions");

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue({ id: "a1", isAdmin: true });
  saveAffiliateCountsMock.mockResolvedValue({ updated: 2, unknown: 1 });
});

describe("importAffiliateCounts", () => {
  it("não deve gravar nada quando quem envia não é admin", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "u1", isAdmin: false });

    const result = await importAffiliateCounts({
      text: "product_id,numero_afiliados\n1,5",
    });

    expect(result.ok).toBe(false);
    expect(saveAffiliateCountsMock).not.toHaveBeenCalled();
  });

  it("deve gravar as linhas com número e resumir o que fez", async () => {
    const result = await importAffiliateCounts({
      text: "product_id,numero_afiliados\n1,5\n2,NA\n3,7\n4,9",
    });

    expect(saveAffiliateCountsMock).toHaveBeenCalledWith(expect.anything(), [
      { productId: "shopee-1", affiliateCount: 5, isMinimum: false },
      { productId: "shopee-3", affiliateCount: 7, isMinimum: false },
      { productId: "shopee-4", affiliateCount: 9, isMinimum: false },
    ]);
    expect(result).toEqual({
      ok: true,
      summary:
        "2 produtos atualizados. 1 produto não está no Radar e ficou de fora. 1 linha veio sem número e manteve o número anterior.",
    });
  });

  it("deve dizer o que falta quando o arquivo não tem as colunas", async () => {
    const result = await importAffiliateCounts({ text: "url,status\nx,ok" });

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("product_id e numero_afiliados"),
    });
    expect(saveAffiliateCountsMock).not.toHaveBeenCalled();
  });
});
