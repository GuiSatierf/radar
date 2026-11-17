/**
 * Reads the affiliate-count file: the CSV written by the affiliate robot, or a sheet typed by the
 * team. Only the product code and the count are required; every other column is optional.
 */

/** Below the 1 MB a server action accepts, with room for the request around it. */
export const MAX_FILE_CHARACTERS = 900_000;
const MAX_ROWS = 20_000;
// Far above any real count ("25.100+" is the largest seen), low enough to catch a broken cell.
const MAX_AFFILIATE_COUNT = 100_000_000;
const MAX_REPORTED_LINES = 5;

const PRODUCT_ID_COLUMNS = ["product_id", "id", "codigo_do_produto"] as const;
const COUNT_COLUMNS = ["numero_afiliados", "afiliados"] as const;
const MINIMUM_COLUMNS = ["numero_minimo", "minimo"] as const;
const STATUS_COLUMN = "status";
// The robot writes a number with these statuses; "id_divergente" means it belongs to another product.
const ACCEPTED_STATUSES = new Set(["ok", "nao_confirmado"]);
const TRUE_WORDS = new Set(["true", "sim", "1"]);
const FALSE_WORDS = new Set(["false", "nao", "não", "0", "", "na"]);
const PRODUCT_ID_PATTERN = /^(?:shopee-)?(\d{1,20})$/;
const COUNT_PATTERN = /^\d+$/;

export interface AffiliateCount {
  /** Our product id, `shopee-<item id>`. */
  readonly productId: string;
  readonly affiliateCount: number;
  /** True when Shopee showed "10+": at least that many. */
  readonly isMinimum: boolean;
}

export interface ParsedAffiliateFile {
  readonly counts: AffiliateCount[];
  /** Rows without a number (the robot could not read it): never erase a saved count. */
  readonly withoutCount: number;
  /** File line numbers that could not be read, at most the first few. */
  readonly invalidLines: number[];
  readonly invalidCount: number;
}

export class InvalidAffiliateFileError extends Error {
  constructor(readonly reason: "empty" | "too-large" | "missing-columns") {
    super(`Invalid affiliate file: ${reason}`);
    this.name = "InvalidAffiliateFileError";
  }
}

/** One CSV line, with quoted fields and "" inside quotes (what Python and Excel write). */
function splitCsvLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = "";
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (isQuoted && character === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      isQuoted = isQuoted === false;
    } else if (character === separator && isQuoted === false) {
      fields.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  fields.push(current);

  return fields.map((field) => field.trim());
}

/** Excel in Portuguese saves with ";", the robot with ",". */
function detectSeparator(header: string): string {
  return header.includes(";") && header.includes(",") === false ? ";" : ",";
}

function findColumn(header: string[], names: readonly string[]): number {
  return header.findIndex((column) => names.includes(column));
}

function parseMinimum(value: string): boolean | null {
  const word = value.toLowerCase();

  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;

  return null;
}

type RowResult =
  | { kind: "count"; count: AffiliateCount }
  | { kind: "without-count" }
  | { kind: "invalid" };

function parseRow(
  fields: string[],
  columns: { id: number; count: number; minimum: number; status: number },
): RowResult {
  const status = columns.status === -1 ? "" : (fields[columns.status] ?? "");
  const countText = fields[columns.count] ?? "";

  if (countText === "" || countText.toUpperCase() === "NA") {
    return { kind: "without-count" };
  }

  if (status !== "" && ACCEPTED_STATUSES.has(status.toLowerCase()) === false) {
    return { kind: "without-count" };
  }

  const idMatch = PRODUCT_ID_PATTERN.exec(fields[columns.id] ?? "");
  const minimum =
    columns.minimum === -1
      ? false
      : parseMinimum(fields[columns.minimum] ?? "");

  if (idMatch == null || COUNT_PATTERN.test(countText) === false) {
    return { kind: "invalid" };
  }

  const affiliateCount = Number(countText);

  if (
    minimum == null ||
    Number.isSafeInteger(affiliateCount) === false ||
    affiliateCount > MAX_AFFILIATE_COUNT
  ) {
    return { kind: "invalid" };
  }

  return {
    kind: "count",
    count: {
      productId: `shopee-${idMatch[1]}`,
      affiliateCount,
      isMinimum: minimum,
    },
  };
}

/**
 * @throws {InvalidAffiliateFileError} When the file is empty, too large, has too many rows or
 * lacks the product code or the count column.
 */
export function parseAffiliateFile(text: string): ParsedAffiliateFile {
  if (text.length > MAX_FILE_CHARACTERS) {
    throw new InvalidAffiliateFileError("too-large");
  }

  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const headerLine = lines[0] ?? "";

  if (headerLine.trim() === "") throw new InvalidAffiliateFileError("empty");

  if (lines.length > MAX_ROWS + 1) {
    throw new InvalidAffiliateFileError("too-large");
  }

  const separator = detectSeparator(headerLine);
  const header = splitCsvLine(headerLine, separator).map((column) =>
    column.toLowerCase(),
  );
  const columns = {
    id: findColumn(header, PRODUCT_ID_COLUMNS),
    count: findColumn(header, COUNT_COLUMNS),
    minimum: findColumn(header, MINIMUM_COLUMNS),
    status: header.indexOf(STATUS_COLUMN),
  };

  if (columns.id === -1 || columns.count === -1) {
    throw new InvalidAffiliateFileError("missing-columns");
  }

  const byProduct = new Map<string, AffiliateCount>();
  const invalidLines: number[] = [];
  let invalidCount = 0;
  let withoutCount = 0;

  for (const [index, line] of lines.entries()) {
    if (index === 0 || line.trim() === "") continue;

    const result = parseRow(splitCsvLine(line, separator), columns);

    if (result.kind === "without-count") {
      withoutCount += 1;
      continue;
    }

    if (result.kind === "invalid") {
      invalidCount += 1;
      if (invalidLines.length < MAX_REPORTED_LINES)
        invalidLines.push(index + 1);
      continue;
    }

    // The robot rewrites a product it read again further down; the last line is the newest.
    byProduct.set(result.count.productId, result.count);
  }

  return {
    counts: [...byProduct.values()],
    withoutCount,
    invalidLines,
    invalidCount,
  };
}
