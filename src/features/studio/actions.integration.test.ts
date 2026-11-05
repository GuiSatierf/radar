import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase } from "@/db/client";
import { product, studioVideo, user } from "@/db/schema";
import { collectProducts } from "@/sources/products/collect-products";
import { createFakeProductSource } from "@/sources/products/fake-product-source";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const checkToolAccessMock = vi.fn();
const afterMock = vi.fn();

vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDatabase: () => db,
}));
vi.mock("@/lib/session", () => ({ checkToolAccess: checkToolAccessMock }));
vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createVideo } = await import("./actions");

const USER_ID = "user-actions";
let productId = "";

function signedInAs(plan: "none" | "full") {
  checkToolAccessMock.mockResolvedValue({
    user: { id: USER_ID, plan, commissionProfile: 3, isAdmin: false },
    isAllowed: plan === "full",
  });
}

beforeEach(async () => {
  afterMock.mockReset();
  await db.execute(
    sql`truncate table "user", ${product}, ${studioVideo} cascade`,
  );
  await db.insert(user).values({
    id: USER_ID,
    name: "Ana",
    email: "ana-actions@integration.test",
  });
  await collectProducts({
    db,
    source: createFakeProductSource(),
    now: new Date(),
  });
  const [first] = await db.select({ id: product.id }).from(product).limit(1);
  productId = first?.id ?? "";
});

afterAll(async () => {
  await pool.end();
});

describe("createVideo", () => {
  it("deve recusar quem não tem acesso, mesmo chamando a ação direto", async () => {
    signedInAs("none");

    const result = await createVideo({ productId, format: "hands" });

    expect(result).toEqual({
      ok: false,
      message: "Sua conta ainda não tem acesso ao Studio.",
    });
    expect(await db.select().from(studioVideo)).toHaveLength(0);
  });

  it("deve recusar formato que não existe", async () => {
    signedInAs("full");

    const result = await createVideo({ productId, format: "avatar" });

    expect(result.ok).toBe(false);
    expect(await db.select().from(studioVideo)).toHaveLength(0);
  });

  it("deve pôr na fila e começar o trabalho logo depois da resposta", async () => {
    signedInAs("full");

    const result = await createVideo({ productId, format: "scene" });

    expect(result).toEqual({ ok: true });
    expect(await db.select().from(studioVideo)).toHaveLength(1);
    expect(afterMock).toHaveBeenCalledOnce();
  });

  it("deve explicar quando os vídeos do mês acabaram", async () => {
    signedInAs("full");
    const monthlyVideos = 12;
    await db.insert(studioVideo).values(
      Array.from({ length: monthlyVideos }, (_, index) => ({
        id: `used-${index}`,
        userId: USER_ID,
        productId,
        productName: "Produto",
        format: "hands",
        status: "ready",
      })),
    );

    const result = await createVideo({ productId, format: "hands" });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain(
      "Você usou os 12 vídeos deste mês",
    );
  });
});
