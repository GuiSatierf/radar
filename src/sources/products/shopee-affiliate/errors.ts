export const SHOPEE_RATE_LIMIT_CODE = "10030";

/** The API answered with an error in the GraphQL body (bad credentials, bad query, …). */
export class ShopeeApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`Shopee affiliate API error ${code}: ${message}`);
    this.name = "ShopeeApiError";
  }
}

/** Code 10030: too many requests. Worth waiting and trying again. */
export class ShopeeRateLimitError extends ShopeeApiError {
  constructor(message: string) {
    super(SHOPEE_RATE_LIMIT_CODE, message);
    this.name = "ShopeeRateLimitError";
  }
}

/** The body did not have the shape we expect; never retried, the data would be wrong anyway. */
export class ShopeeInvalidResponseError extends Error {
  constructor(details: string, options?: { cause?: unknown }) {
    super(`Unexpected Shopee affiliate API response: ${details}`, options);
    this.name = "ShopeeInvalidResponseError";
  }
}

/** Network failure, timeout or HTTP error, after the allowed retries. */
export class ShopeeRequestFailedError extends Error {
  constructor(details: string, options?: { cause?: unknown }) {
    super(`Shopee affiliate API request failed: ${details}`, options);
    this.name = "ShopeeRequestFailedError";
  }
}
