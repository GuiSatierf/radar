/**
 * The `productOfferV2` query. Arguments are written into the query text (JSON string literals are
 * valid GraphQL strings), because third-party examples never use GraphQL variables with this API.
 */
export const MAX_PAGE_SIZE = 50;

/** Sort orders seen in third-party docs; confirm the numbers with the official docs. */
export const OFFER_SORT = {
  relevance: 1,
  mostSold: 2,
  highestCommission: 5,
} as const;

export type OfferSort = keyof typeof OFFER_SORT;

export interface OfferPageRequest {
  readonly keyword?: string;
  readonly categoryId?: number;
  readonly sort?: OfferSort;
  readonly page: number;
  readonly limit: number;
}

const NODE_FIELDS = [
  "itemId",
  "productName",
  "productCatIds",
  "shopId",
  "shopName",
  "priceMin",
  "priceMax",
  "sales",
  "ratingStar",
  "commissionRate",
  "sellerCommissionRate",
  "shopeeCommissionRate",
  "imageUrl",
  "productLink",
  "offerLink",
].join(" ");

export class InvalidOfferRequestError extends Error {
  constructor(field: string) {
    super(`Invalid offer request: ${field} must be a positive integer`);
    this.name = "InvalidOfferRequestError";
  }
}

function requirePositiveInteger(field: string, value: number): void {
  if (Number.isInteger(value) && value > 0) return;

  throw new InvalidOfferRequestError(field);
}

/** Numbers go into the query text, so they are checked first (no "NaN" in a query). */
export function buildOfferQuery(request: OfferPageRequest): string {
  requirePositiveInteger("page", request.page);
  requirePositiveInteger("limit", request.limit);

  if (request.categoryId != null)
    requirePositiveInteger("categoryId", request.categoryId);

  const args = [
    request.keyword == null
      ? null
      : `keyword: ${JSON.stringify(request.keyword)}`,
    request.categoryId == null ? null : `productCatId: ${request.categoryId}`,
    request.sort == null ? null : `sortType: ${OFFER_SORT[request.sort]}`,
    `page: ${request.page}`,
    `limit: ${request.limit}`,
  ].filter((arg) => arg != null);

  return `{ productOfferV2(${args.join(", ")}) { nodes { ${NODE_FIELDS} } pageInfo { page limit hasNextPage } } }`;
}
