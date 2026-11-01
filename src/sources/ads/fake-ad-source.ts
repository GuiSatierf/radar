import { fakeProductUrl } from "@/sources/products/fake-product-source";
import type { AdSource } from "./ad-source";

/**
 * Stands in for an automatic collector or a supplier of the Meta ad library: fictitious advertisers and texts,
 * ids that do not exist in the library. Dates are relative to `today`, so the list never ages.
 */
interface FakeAd {
  readonly libraryAdId: string;
  readonly advertiserName: string;
  readonly adText: string;
  readonly platforms: readonly string[];
  readonly daysOnAir: number;
  /** Days ago the ad stopped; null while it runs. */
  readonly stoppedDaysAgo: number | null;
  readonly productName: string | null;
}

const FAKE_ADS: readonly FakeAd[] = [
  {
    libraryAdId: "800000000000001",
    advertiserName: "Cozinha Prática Ofertas",
    adText: "O mixer que faz tudo em 30 segundos. Frete grátis hoje.",
    platforms: ["facebook", "instagram"],
    daysOnAir: 302,
    stoppedDaysAgo: null,
    productName: "Mixer de mão 3 velocidades",
  },
  {
    libraryAdId: "800000000000002",
    advertiserName: "Achados da Casa",
    adText: "Organização que cabe em qualquer gaveta. Veja o antes e depois.",
    platforms: ["instagram"],
    daysOnAir: 145,
    stoppedDaysAgo: null,
    productName: "Organizador de gaveta em bambu",
  },
  {
    libraryAdId: "800000000000003",
    advertiserName: "Luz & Lar",
    adText: "Luminária sem fio que carrega pelo USB. Ideal para home office.",
    platforms: ["facebook", "audience_network_unknown"],
    daysOnAir: 88,
    stoppedDaysAgo: null,
    productName: "Luminária de mesa LED recarregável",
  },
  {
    libraryAdId: "800000000000004",
    advertiserName: "Cheirinho Bom",
    adText: "Sua casa com cheiro de hotel. Difusor com 7 cores de luz.",
    platforms: ["instagram", "facebook"],
    daysOnAir: 120,
    stoppedDaysAgo: 9,
    productName: "Difusor de aromas 300 ml",
  },
  {
    libraryAdId: "800000000000005",
    advertiserName: "Natal Encantado",
    adText: "Decore a árvore com 24 bolas por um preço que cabe no bolso.",
    platforms: ["facebook"],
    daysOnAir: 26,
    stoppedDaysAgo: null,
    productName: "Kit 24 bolas para árvore de Natal",
  },
  {
    libraryAdId: "800000000000006",
    advertiserName: "Supermercado Bom Preço",
    adText: "Ofertas da semana no grupo de WhatsApp. Entre agora!",
    platforms: ["whatsapp", "facebook"],
    daysOnAir: 64,
    stoppedDaysAgo: null,
    productName: null,
  },
  {
    // Also curated by hand in the demo data: the collection only updates when it was seen.
    libraryAdId: "900000000000002",
    advertiserName: "Loja da Ju (nome da fonte)",
    adText: "Texto que a fonte trouxe e que não deve apagar o da curadoria.",
    platforms: ["instagram"],
    daysOnAir: 97,
    stoppedDaysAgo: null,
    productName: null,
  },
];

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function toSnapshot(fake: FakeAd, today: string) {
  const lastDay =
    fake.stoppedDaysAgo == null
      ? today
      : shiftDays(today, -fake.stoppedDaysAgo);

  return {
    libraryAdId: fake.libraryAdId,
    advertiserName: fake.advertiserName,
    adText: fake.adText,
    platforms: [...fake.platforms],
    startedOn: shiftDays(lastDay, -fake.daysOnAir),
    stoppedOn: fake.stoppedDaysAgo == null ? null : lastDay,
    productUrl:
      fake.productName == null ? null : fakeProductUrl(fake.productName),
  };
}

export const FAKE_AD_SOURCE_NAME = "fake";

/** `today` is a calendar day (YYYY-MM-DD). */
export function createFakeAdSource(today: string): AdSource {
  return {
    name: FAKE_AD_SOURCE_NAME,
    fetchAds: async () => FAKE_ADS.map((fake) => toSnapshot(fake, today)),
  };
}
