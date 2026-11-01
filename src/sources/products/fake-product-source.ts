import type { ProductSnapshot, ProductSource } from "./product-source";

/**
 * Fictitious catalog for development, the demo environment and every test. Deterministic: the
 * same seed always gives the same products, so screenshots and tests are stable.
 */
interface CatalogEntry {
  readonly name: string;
  readonly categorySlug: string;
  readonly categoryLabel: string;
  readonly isChristmas?: boolean;
}

const CATALOG: readonly CatalogEntry[] = [
  {
    name: "Kit 3 utensílios de silicone para cozinha",
    categorySlug: "cozinha",
    categoryLabel: "Cozinha",
  },
  {
    name: "Garrafa térmica 1 litro inox",
    categorySlug: "cozinha",
    categoryLabel: "Cozinha",
  },
  {
    name: "Mixer de mão 3 velocidades",
    categorySlug: "cozinha",
    categoryLabel: "Cozinha",
  },
  {
    name: "Potes herméticos de vidro kit 5 peças",
    categorySlug: "cozinha",
    categoryLabel: "Cozinha",
  },
  {
    name: "Tábua de churrasco com tampa",
    categorySlug: "cozinha",
    categoryLabel: "Cozinha",
  },
  {
    name: "Organizador de gaveta em bambu",
    categorySlug: "casa-e-decoracao",
    categoryLabel: "Casa e Decoração",
  },
  {
    name: "Luminária de mesa LED recarregável",
    categorySlug: "casa-e-decoracao",
    categoryLabel: "Casa e Decoração",
  },
  {
    name: "Difusor de aromas 300 ml",
    categorySlug: "casa-e-decoracao",
    categoryLabel: "Casa e Decoração",
  },
  {
    name: "Tapete antiderrapante para banheiro",
    categorySlug: "casa-e-decoracao",
    categoryLabel: "Casa e Decoração",
  },
  {
    name: "Cortina blackout 2,80 m",
    categorySlug: "casa-e-decoracao",
    categoryLabel: "Casa e Decoração",
  },
  {
    name: "Pisca-pisca 100 LEDs luz quente",
    categorySlug: "casa-e-decoracao",
    categoryLabel: "Casa e Decoração",
    isChristmas: true,
  },
  {
    name: "Kit 24 bolas para árvore de Natal",
    categorySlug: "casa-e-decoracao",
    categoryLabel: "Casa e Decoração",
    isChristmas: true,
  },
  {
    name: "Guirlanda de Natal 40 cm",
    categorySlug: "casa-e-decoracao",
    categoryLabel: "Casa e Decoração",
    isChristmas: true,
  },
  {
    name: "Escova secadora 3 em 1",
    categorySlug: "beleza",
    categoryLabel: "Beleza",
  },
  {
    name: "Sérum facial vitamina C 30 ml",
    categorySlug: "beleza",
    categoryLabel: "Beleza",
  },
  {
    name: "Kit pincéis de maquiagem 12 peças",
    categorySlug: "beleza",
    categoryLabel: "Beleza",
  },
  {
    name: "Prancha alisadora de cerâmica",
    categorySlug: "beleza",
    categoryLabel: "Beleza",
  },
  {
    name: "Body splash 200 ml",
    categorySlug: "beleza",
    categoryLabel: "Beleza",
  },
  {
    name: "Cropped canelado básico",
    categorySlug: "moda-feminina",
    categoryLabel: "Moda Feminina",
  },
  {
    name: "Calça pantalona de linho",
    categorySlug: "moda-feminina",
    categoryLabel: "Moda Feminina",
  },
  {
    name: "Vestido midi estampado",
    categorySlug: "moda-feminina",
    categoryLabel: "Moda Feminina",
  },
  {
    name: "Bolsa transversal pequena",
    categorySlug: "moda-feminina",
    categoryLabel: "Moda Feminina",
  },
  {
    name: "Conjunto fitness legging e top",
    categorySlug: "esporte-e-lazer",
    categoryLabel: "Esporte e Lazer",
  },
  {
    name: "Garrafa de água 2 litros com marcador",
    categorySlug: "esporte-e-lazer",
    categoryLabel: "Esporte e Lazer",
  },
  {
    name: "Elástico de treino kit 5 forças",
    categorySlug: "esporte-e-lazer",
    categoryLabel: "Esporte e Lazer",
  },
  {
    name: "Tapete de yoga 6 mm",
    categorySlug: "esporte-e-lazer",
    categoryLabel: "Esporte e Lazer",
  },
  {
    name: "Fone de ouvido sem fio com estojo",
    categorySlug: "celulares-e-acessorios",
    categoryLabel: "Celulares e Acessórios",
  },
  {
    name: "Cabo 3 em 1 carregamento rápido",
    categorySlug: "celulares-e-acessorios",
    categoryLabel: "Celulares e Acessórios",
  },
  {
    name: "Suporte de celular para carro",
    categorySlug: "celulares-e-acessorios",
    categoryLabel: "Celulares e Acessórios",
  },
  {
    name: "Ring light 26 cm com tripé",
    categorySlug: "celulares-e-acessorios",
    categoryLabel: "Celulares e Acessórios",
  },
  {
    name: "Carregador portátil 10.000 mAh",
    categorySlug: "celulares-e-acessorios",
    categoryLabel: "Celulares e Acessórios",
  },
  {
    name: "Mordedor de silicone para bebê",
    categorySlug: "infantil",
    categoryLabel: "Infantil",
  },
  {
    name: "Quebra-cabeça de madeira 3D",
    categorySlug: "infantil",
    categoryLabel: "Infantil",
    isChristmas: true,
  },
  {
    name: "Mochila escolar de rodinhas",
    categorySlug: "infantil",
    categoryLabel: "Infantil",
  },
  {
    name: "Luminária infantil de nuvem",
    categorySlug: "infantil",
    categoryLabel: "Infantil",
  },
  {
    name: "Comedouro elevado para cachorro",
    categorySlug: "pet",
    categoryLabel: "Pet",
  },
  {
    name: "Arranhador para gato com bolinha",
    categorySlug: "pet",
    categoryLabel: "Pet",
  },
  { name: "Cama pet redonda média", categorySlug: "pet", categoryLabel: "Pet" },
  {
    name: "Escova removedora de pelos",
    categorySlug: "pet",
    categoryLabel: "Pet",
  },
  {
    name: "Aspirador portátil sem fio",
    categorySlug: "casa-e-decoracao",
    categoryLabel: "Casa e Decoração",
  },
];

const CREATOR_HANDLES = [
  "achadosdamari",
  "casadajuh",
  "dicasdaana",
  "lar.organizado",
  "bia.achadinhos",
  "cozinhacomlu",
  "fe.recomenda",
  "maequeacha",
  "lojinhadacarol",
  "testeitudo",
  "tati.casa",
  "rafa.promos",
] as const;

const SELLER_RATES_BASIS_POINTS = [
  0, 0, 0, 100, 400, 500, 1_000, 1_200,
] as const;
const SHOPS = [
  "Casa Bonita",
  "Mundo Útil",
  "Loja da Vila",
  "Bella Store",
  "Ponto Certo",
] as const;

/** Small deterministic generator (mulberry32). */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

class EmptyChoiceListError extends Error {
  constructor() {
    super("pick() needs a non-empty list");
    this.name = "EmptyChoiceListError";
  }
}

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];

  if (item === undefined) throw new EmptyChoiceListError();

  return item;
}

/** Spread affiliates over the low, medium and high bands (log scale, 0 to ~5,000). */
function randomAffiliates(random: () => number): number {
  return Math.round(10 ** (random() * 3.7)) - 1;
}

function buildVideos(
  random: () => number,
  count: number,
): ProductSnapshot["videos"] {
  const topViews = Math.round(10 ** (2 + random() * 3.5));

  return Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    creatorHandle: pick(CREATOR_HANDLES, random),
    views: Math.max(50, Math.round(topViews / (1 + index * (0.8 + random())))),
    caption: null,
    videoUrl: null,
  }));
}

/** The demo catalog has no real Shopee pages, so each product links to a Shopee search. */
export function fakeProductUrl(productName: string): string {
  return `https://shopee.com.br/search?keyword=${encodeURIComponent(productName)}`;
}

function buildProduct(
  entry: CatalogEntry,
  index: number,
  random: () => number,
): ProductSnapshot {
  const priceCents = Math.round((15 + random() * 185) * 100);
  const hasPriceRange = random() < 0.3;
  const affiliateCount = randomAffiliates(random);
  const isUnselling = index % 13 === 7;

  return {
    id: `demo-${String(index + 1).padStart(3, "0")}`,
    name: entry.name,
    categorySlug: entry.categorySlug,
    categoryLabel: entry.categoryLabel,
    shopName: pick(SHOPS, random),
    productUrl: fakeProductUrl(entry.name),
    imageUrls: [],
    priceCents,
    priceMaxCents: hasPriceRange
      ? priceCents + Math.round(random() * 4_000)
      : priceCents,
    sellerRateBasisPoints: pick(SELLER_RATES_BASIS_POINTS, random),
    ratingTenths: 40 + Math.floor(random() * 11),
    ratingCount: Math.round(10 ** (1 + random() * 3)),
    monthlySales: isUnselling ? 0 : Math.round(10 ** (random() * 3.8)),
    stock: random() < 0.15 ? null : Math.round(random() * 2_000),
    affiliateCount,
    // Like Shopee's "10+": only a count of at least 10 can be a minimum.
    affiliateCountIsMinimum:
      affiliateCount >= 10 && affiliateCount < 20 && random() < 0.5,
    hasFreeSample: random() < 0.2,
    seasonalTags: entry.isChristmas ? ["natal"] : [],
    videos: buildVideos(random, Math.min(10, Math.floor(random() * 11))),
  };
}

export const DEMO_SEED = 20_261_020;

export function createFakeProductSource(seed = DEMO_SEED): ProductSource {
  return {
    name: "fake",
    fetchProducts: async () => {
      const random = createRandom(seed);

      return CATALOG.map((entry, index) => buildProduct(entry, index, random));
    },
  };
}
