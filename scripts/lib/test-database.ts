const TEST_DATABASE_SUFFIX = "_test";
const SAFE_DATABASE_NAME = /^[a-z0-9_]+$/;

export class UnsafeTestDatabaseError extends Error {
  constructor(reason: string) {
    super(`TEST_DATABASE_URL ${reason}. Run "npm run setup" first.`);
    this.name = "UnsafeTestDatabaseError";
  }
}

/**
 * The single guard every test runner uses: tests only ever touch a database whose name ends in
 * _test, never development or production. Returns the database name.
 */
export function requireTestDatabaseName(url: string | undefined): string {
  if (url == null || url.trim().length === 0) {
    throw new UnsafeTestDatabaseError("is missing");
  }

  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));

  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new UnsafeTestDatabaseError(
      "must point to a database ending in _test",
    );
  }

  if (!SAFE_DATABASE_NAME.test(name)) {
    throw new UnsafeTestDatabaseError(
      "must use only a-z, 0-9 and _ in the name",
    );
  }

  return name;
}
