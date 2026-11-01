/**
 * Shopee Brasil top-level categories, as the affiliate API numbers them (`productCatIds[0]`).
 * The API has no category list, so the names were read from the products each id returned
 * (22/10/2026). 100642 is left out: it only holds "shipping" and "warranty" listings.
 */
export interface ShopeeCategory {
  readonly id: number;
  readonly slug: string;
  readonly label: string;
}

export const SHOPEE_CATEGORIES: readonly ShopeeCategory[] = [
  { id: 100001, slug: "saude", label: "Saúde" },
  { id: 100009, slug: "acessorios-de-moda", label: "Acessórios de moda" },
  { id: 100010, slug: "eletroportateis", label: "Eletroportáteis" },
  { id: 100011, slug: "moda-masculina", label: "Moda masculina" },
  { id: 100012, slug: "calcados-masculinos", label: "Calçados masculinos" },
  { id: 100013, slug: "celulares", label: "Celulares e acessórios" },
  { id: 100015, slug: "viagem", label: "Viagem e bagagem" },
  { id: 100016, slug: "bolsas-femininas", label: "Bolsas femininas" },
  { id: 100017, slug: "moda-feminina", label: "Moda feminina" },
  { id: 100532, slug: "calcados-femininos", label: "Calçados femininos" },
  {
    id: 100533,
    slug: "bolsas-masculinas",
    label: "Bolsas e carteiras masculinas",
  },
  { id: 100534, slug: "relogios", label: "Relógios" },
  { id: 100535, slug: "audio", label: "Áudio" },
  { id: 100629, slug: "alimentos", label: "Alimentos e bebidas" },
  { id: 100630, slug: "beleza", label: "Beleza" },
  { id: 100631, slug: "pet", label: "Pet" },
  { id: 100632, slug: "mae-e-bebe", label: "Mãe e bebê" },
  { id: 100633, slug: "moda-infantil", label: "Moda infantil" },
  { id: 100634, slug: "games", label: "Games" },
  { id: 100635, slug: "cameras", label: "Câmeras" },
  { id: 100636, slug: "casa-e-decoracao", label: "Casa e decoração" },
  { id: 100637, slug: "esportes-e-lazer", label: "Esportes e lazer" },
  { id: 100638, slug: "papelaria", label: "Papelaria" },
  { id: 100639, slug: "hobbies", label: "Hobbies e coleções" },
  { id: 100640, slug: "automotivo", label: "Automotivo" },
  { id: 100641, slug: "motos", label: "Motos" },
  { id: 100643, slug: "livros", label: "Livros e revistas" },
  { id: 100644, slug: "computadores", label: "Computadores e acessórios" },
];
