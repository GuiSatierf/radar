import {
  ShopeeInvalidResponseError,
  ShopeeRateLimitError,
  ShopeeRequestFailedError,
  ShopeeSystemError,
} from "./errors";
import {
  buildOfferQuery,
  InvalidOfferRequestError,
  MAX_PAGE_SIZE,
  type OfferPageRequest,
  type OfferSort,
} from "./query";
import { parseOfferPage, type ShopeeOffer } from "./response";
import { buildAuthorizationHeader } from "./signature";

export const SHOPEE_AFFILIATE_ENDPOINT =
  "https://open-api.affiliate.shopee.com.br/graphql";

const DEFAULT_TIMEOUT_MS = 15_000;
// A third of the calls failed with 10000 in a test on 10/11/2026: 5 attempts (up to 15 s of
// waiting) leave about 0.4% of the calls failing, against 4% with 3.
const DEFAULT_MAX_ATTEMPTS = 5;
const FIRST_RETRY_DELAY_MS = 1_000;
const MILLISECONDS_PER_SECOND = 1_000;

export interface ShopeeCredentials {
  readonly appId: string;
  readonly secret: string;
}

export interface ShopeeClientOptions {
  readonly credentials: ShopeeCredentials;
  /** Injected so tests never touch the network. */
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly endpoint?: string;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
}

export interface OfferPage {
  readonly offers: ShopeeOffer[];
  readonly skipped: number;
  readonly hasNextPage: boolean;
}

/** HTTP statuses where waiting and trying again can help. */
class RetryableHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = "RetryableHttpError";
  }
}

/** fetch itself rejected: no connection, DNS, reset or our timeout. */
class NetworkError extends Error {
  constructor(cause: unknown) {
    super("network failure or timeout", { cause });
    this.name = "NetworkError";
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Network failures, timeouts, rate limits and 5xx are retried; wrong data or auth never is.
 * Only errors raised by fetch count as network errors, so a bug of ours is never retried.
 */
function isRetryable(error: unknown): boolean {
  return (
    error instanceof ShopeeRateLimitError ||
    error instanceof ShopeeSystemError ||
    error instanceof RetryableHttpError ||
    error instanceof NetworkError
  );
}

async function fetchOrNetworkError(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetchFn(url, init);
  } catch (error) {
    throw new NetworkError(error);
  }
}

const MAX_ERROR_TEXT = 200;

async function readShortText(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim().slice(0, MAX_ERROR_TEXT);

    return text.length === 0 ? "(empty body)" : text;
  } catch {
    // The status code alone still says what happened; the body was only a bonus.
    return "(body unreadable)";
  }
}

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createShopeeAffiliateClient(options: ShopeeClientOptions) {
  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? defaultSleep;
  const endpoint = options.endpoint ?? SHOPEE_AFFILIATE_ENDPOINT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  async function postOnce(payload: string): Promise<unknown> {
    const response = await fetchOrNetworkError(fetchFn, endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthorizationHeader({
          ...options.credentials,
          timestampSeconds: Math.floor(
            now().getTime() / MILLISECONDS_PER_SECOND,
          ),
          payload,
        }),
      },
      body: payload,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (RETRYABLE_STATUS.has(response.status))
      throw new RetryableHttpError(response.status);

    if (!response.ok) {
      // Shopee's explanation (expired key, bad signature) is in the body; keep a short piece.
      const explanation = await readShortText(response);
      throw new ShopeeRequestFailedError(
        `HTTP ${response.status}: ${explanation}`,
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ShopeeInvalidResponseError("body is not JSON", {
        cause: error,
      });
    }
  }

  async function fetchPageOnce(request: OfferPageRequest): Promise<OfferPage> {
    const payload = JSON.stringify({ query: buildOfferQuery(request) });

    return parseOfferPage(await postOnce(payload));
  }

  /** One page, retried with exponential backoff (1 s, 2 s, …) only when retrying can help. */
  async function fetchOfferPage(request: OfferPageRequest): Promise<OfferPage> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await fetchPageOnce(request);
      } catch (error) {
        if (!isRetryable(error)) throw error;

        if (attempt >= maxAttempts) {
          throw new ShopeeRequestFailedError(
            `gave up after ${attempt} attempts`,
            {
              cause: error,
            },
          );
        }

        await sleep(FIRST_RETRY_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }

  /** Every page of a search, up to `maxPages`, in order. */
  async function fetchOffers(input: {
    keyword?: string;
    categoryId?: number;
    sort?: OfferSort;
    maxPages: number;
  }): Promise<{ offers: ShopeeOffer[]; skipped: number }> {
    // A bad page count (NaN from an unset variable) must fail, not look like an empty source.
    if (!Number.isInteger(input.maxPages) || input.maxPages < 1) {
      throw new InvalidOfferRequestError("maxPages");
    }

    const offers: ShopeeOffer[] = [];
    let skipped = 0;

    for (let page = 1; page <= input.maxPages; page += 1) {
      const result = await fetchOfferPage({
        ...input,
        page,
        limit: MAX_PAGE_SIZE,
      });
      offers.push(...result.offers);
      skipped += result.skipped;

      if (!result.hasNextPage) break;
    }

    return { offers, skipped };
  }

  return { fetchOfferPage, fetchOffers };
}

export type ShopeeAffiliateClient = ReturnType<
  typeof createShopeeAffiliateClient
>;
