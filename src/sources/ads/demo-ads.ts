import { asc } from "drizzle-orm";
import type { Database } from "@/db/client";
import { ad, product } from "@/db/schema";
import type { AdPlatform } from "@/features/ads/domain/ads";

/**
 * Fictitious curated ads for development, the demo environment and tests. Advertisers and texts
 * are made up; the library ids do not exist in the Meta ad library.
 */
interface DemoAd {
  readonly libraryAdId: string;
  readonly advertiserName: string;
  readonly adText: string;
  readonly platforms: readonly AdPlatform[];
  readonly daysOnAir: number;
  /** Days since someone last confirmed the ad was running. */
  readonly checkedDaysAgo: number;
}

const DEMO_ADS: readonly DemoAd[] = [
  {
    libraryAdId: "900000000000001",
    advertiserName: "Casa Bonita Achados",
    adText:
      "Acabou a bagunça na cozinha! Esse kit resolve três problemas de uma vez. Link na bio.",
    platforms: ["instagram", "facebook"],
    daysOnAir: 214,
    checkedDaysAgo: 0,
  },
  {
    libraryAdId: "900000000000002",
    advertiserName: "Loja da Ju Oficial",
    adText:
      "Mantém gelado o dia inteiro. Testei no calor e funcionou. Últimas unidades com frete grátis.",
    platforms: ["instagram"],
    daysOnAir: 96,
    checkedDaysAgo: 1,
  },
  {
    libraryAdId: "900000000000003",
    advertiserName: "Achei na Shopee BR",
    adText:
      "O presente que todo mundo pediu este mês. Vem ver antes que acabe.",
    platforms: ["facebook", "messenger"],
    daysOnAir: 61,
    checkedDaysAgo: 0,
  },
  {
    libraryAdId: "900000000000004",
    advertiserName: "Dicas da Bia",
    adText: "Comprei, gostei e voltei para contar. Olha o antes e depois.",
    platforms: ["instagram", "facebook", "audience-network"],
    daysOnAir: 33,
    checkedDaysAgo: 2,
  },
  {
    libraryAdId: "900000000000005",
    advertiserName: "Mundo Pet Ofertas",
    adText: "Seu pet merece dormir bem. Tamanho médio com desconto hoje.",
    platforms: ["instagram"],
    daysOnAir: 18,
    checkedDaysAgo: 0,
  },
  {
    libraryAdId: "900000000000006",
    advertiserName: "Beleza Rápida",
    adText: "Rotina de 5 minutos que mudou minha pele. Produto no link.",
    platforms: ["instagram", "threads"],
    daysOnAir: 7,
    checkedDaysAgo: 0,
  },
];

/** An ad for a product outside the catalog, shown with only the ad link. */
const OUT_OF_CATALOG_AD: DemoAd = {
  libraryAdId: "900000000000007",
  advertiserName: "Achadinhos da Mari",
  adText: "Esse organizador mudou meu guarda-roupa. Corre que está barato.",
  platforms: ["facebook"],
  daysOnAir: 41,
  checkedDaysAgo: 3,
};

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function toRow(demo: DemoAd, today: string, productId: string | null) {
  const lastSeenOn = shiftDays(today, -demo.checkedDaysAgo);

  return {
    libraryAdId: demo.libraryAdId,
    advertiserName: demo.advertiserName,
    adText: demo.adText,
    platforms: [...demo.platforms],
    startedOn: shiftDays(lastSeenOn, -demo.daysOnAir),
    lastSeenOn,
    productId,
    productUrl:
      productId == null ? "https://shopee.com.br/organizador-exemplo" : null,
  };
}

/**
 * Inserts the demo ads, linked to the first catalog products. Running it again changes nothing.
 * `today` is a calendar day (YYYY-MM-DD).
 */
export async function seedDemoAds(
  db: Database,
  today: string,
): Promise<number> {
  const products = await db
    .select({ id: product.id })
    .from(product)
    .orderBy(asc(product.id))
    .limit(DEMO_ADS.length);
  const rows = [
    ...DEMO_ADS.map((demo, index) =>
      toRow(demo, today, products[index]?.id ?? null),
    ),
    toRow(OUT_OF_CATALOG_AD, today, null),
  ];

  const inserted = await db
    .insert(ad)
    .values(rows)
    .onConflictDoNothing({ target: ad.libraryAdId })
    .returning({ id: ad.id });

  return inserted.length;
}
