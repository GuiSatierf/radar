import { z } from "zod";
import { fractionToBasisPoints, toCents, toTenths } from "./decimal";
import {
  SHOPEE_RATE_LIMIT_CODE,
  ShopeeApiError,
  ShopeeInvalidResponseError,
  ShopeeRateLimitError,
} from "./errors";

/** An offer from `productOfferV2`, already in our units (cents, basis points, tenths). */
export interface ShopeeOffer {
  readonly itemId: string;
  readonly shopId: string;
  readonly name: string;
  readonly categoryIds: readonly number[];
  readonly shopName: string;
  readonly priceCents: number;
  readonly priceMaxCents: number;
  /** `sales` as the API reports it (third-party tools read it as the last 30 days). */
  readonly sales: number;
  readonly ratingTenths: number | null;
  readonly commissionBasisPoints: number;
  readonly sellerRateBasisPoints: number;
  readonly shopeeRateBasisPoints: number;
  readonly imageUrl: string | null;
  readonly productUrl: string;
  readonly affiliateUrl: string;
}

// The API mixes numbers and decimal strings; both are read as text and converted exactly.
// Anything that is not a plain non-negative decimal fails here, so that offer is skipped.
const DECIMAL = /^\d+(\.\d+)?$/;
const decimalText = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(DECIMAL));
const optionalDecimalText = decimalText
  .nullish()
  .transform((value) => value ?? "0");
const blankToNull = (value: string | null | undefined) =>
  value == null || value.trim().length === 0 ? null : value.trim();

const httpsUrl = z.url({ protocol: /^https$/ });

/** A bad photo link only loses the photo, never the whole offer. */
const optionalImageUrl = z
  .string()
  .nullish()
  .transform((value) => {
    const candidate = blankToNull(value);

    return httpsUrl.safeParse(candidate).success ? candidate : null;
  });

/** A count must really be there: null or "" never turn into 0 sales. */
const count = z.union([
  z.number().int().min(0),
  z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number.parseInt(value, 10)),
]);

const nodeSchema = z.object({
  itemId: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().regex(/^\d+$/)),
  productName: z.string().trim().min(1),
  productCatIds: z.array(z.coerce.number().int()).nullish(),
  shopId: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().regex(/^\d+$/)),
  shopName: z.string().trim().min(1),
  priceMin: decimalText,
  priceMax: decimalText,
  sales: count,
  ratingStar: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((value) => blankToNull(value == null ? null : String(value)))
    .pipe(z.string().regex(DECIMAL).nullable()),
  commissionRate: optionalDecimalText,
  sellerCommissionRate: optionalDecimalText,
  shopeeCommissionRate: optionalDecimalText,
  imageUrl: optionalImageUrl,
  productLink: httpsUrl,
  offerLink: httpsUrl,
});

const envelopeSchema = z.object({
  data: z
    .object({
      productOfferV2: z.object({
        nodes: z.array(z.unknown()),
        pageInfo: z.object({ hasNextPage: z.boolean() }),
      }),
    })
    .nullish(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        extensions: z
          .object({ code: z.union([z.string(), z.number()]) })
          .partial()
          .nullish(),
      }),
    )
    .nullish(),
});

export type OfferNode = z.output<typeof nodeSchema>;

function toOffer(node: OfferNode): ShopeeOffer {
  return {
    itemId: node.itemId,
    shopId: node.shopId,
    name: node.productName,
    categoryIds: node.productCatIds ?? [],
    shopName: node.shopName,
    priceCents: toCents(node.priceMin),
    priceMaxCents: toCents(node.priceMax),
    sales: node.sales,
    ratingTenths: node.ratingStar == null ? null : toTenths(node.ratingStar),
    commissionBasisPoints: fractionToBasisPoints(node.commissionRate),
    sellerRateBasisPoints: fractionToBasisPoints(node.sellerCommissionRate),
    shopeeRateBasisPoints: fractionToBasisPoints(node.shopeeCommissionRate),
    imageUrl: node.imageUrl,
    productUrl: node.productLink,
    affiliateUrl: node.offerLink,
  };
}

function throwApiError(
  errors: { message: string; extensions?: { code?: string | number } | null }[],
): never {
  const first = errors[0];
  const code = String(first?.extensions?.code ?? "unknown");
  const message = first?.message ?? "no message";

  if (code === SHOPEE_RATE_LIMIT_CODE) throw new ShopeeRateLimitError(message);

  throw new ShopeeApiError(code, message);
}

/**
 * Validates one page at the edge. An API error or a malformed envelope throws; a single bad
 * offer is skipped (and counted) so one broken product never loses the whole page.
 */
export function parseOfferPage(body: unknown): {
  offers: ShopeeOffer[];
  skipped: number;
  hasNextPage: boolean;
} {
  const envelope = envelopeSchema.safeParse(body);

  if (!envelope.success) {
    throw new ShopeeInvalidResponseError("envelope", { cause: envelope.error });
  }

  const { data, errors } = envelope.data;

  if (errors != null && errors.length > 0) throwApiError(errors);

  if (data == null)
    throw new ShopeeInvalidResponseError("no data and no errors");

  const offers = data.productOfferV2.nodes.flatMap((raw) => {
    const node = nodeSchema.safeParse(raw);

    return node.success ? [toOffer(node.data)] : [];
  });

  return {
    offers,
    skipped: data.productOfferV2.nodes.length - offers.length,
    hasNextPage: data.productOfferV2.pageInfo.hasNextPage,
  };
}
