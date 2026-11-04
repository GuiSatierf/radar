import { z } from "zod";

const MIN_SECRET_LENGTH = 32;
const DEFAULT_APP_NAME = "Prisciane";
const DEFAULT_LOG_LEVEL = "info";
const RESEND_KEY_PREFIX = "re_";
// "endereco@dominio" or "Nome <endereco@dominio>".
const SENDER_ADDRESS =
  /^(?:[^<>@]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/;

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** `KEY=""` in a .env file means "not set". */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;

const serverEnvSchema = z.object({
  APP_NAME: z.string().trim().min(1).default(DEFAULT_APP_NAME),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  BETTER_AUTH_SECRET: z.string().min(MIN_SECRET_LENGTH),
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
  // Header with the real client IP, set (overwritten) by the reverse proxy.
  CLIENT_IP_HEADER: z.string().trim().toLowerCase().min(1).default("x-real-ip"),
  LOG_LEVEL: z.enum(LOG_LEVELS).default(DEFAULT_LOG_LEVEL),
  // Where "Falar com o suporte" leads (a WhatsApp link, for example). Optional.
  SUPPORT_URL: z.preprocess(
    blankToUndefined,
    z.url({ protocol: /^https$/ }).optional(),
  ),
  // Development and tests only: e-mails go to a file in this folder instead of being sent.
  EMAIL_OUTBOX_DIR: z.preprocess(
    blankToUndefined,
    z.string().trim().min(1).optional(),
  ),
  // Real e-mail through Resend. Both or neither: the key alone would have no sender address.
  RESEND_API_KEY: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .startsWith(RESEND_KEY_PREFIX, {
        error: "a chave do Resend começa com re_",
      })
      .optional(),
  ),
  EMAIL_FROM: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .regex(SENDER_ADDRESS, { error: 'use "Nome <endereco@dominio>"' })
      .optional(),
  ),
  // Encrypts the video AI keys an admin saves. Without it, the admin cannot save keys.
  VIDEO_KEYS_SECRET: z.preprocess(
    blankToUndefined,
    z.string().min(MIN_SECRET_LENGTH).optional(),
  ),
});

const serverEnvWithEmailSchema = serverEnvSchema.refine(
  (env) => (env.RESEND_API_KEY == null) === (env.EMAIL_FROM == null),
  {
    path: ["EMAIL_FROM"],
    error: "RESEND_API_KEY e EMAIL_FROM vão juntos",
  },
);

/** For the logger, which loads before the full env is parsed: a bad value falls back to info. */
export function resolveLogLevel(value: string | undefined): LogLevel {
  const normalized = value?.trim().toLowerCase();

  return LOG_LEVELS.find((level) => level === normalized) ?? DEFAULT_LOG_LEVEL;
}

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class InvalidEnvError extends Error {
  constructor(issues: string) {
    super(`Invalid environment variables: ${issues}`);
    this.name = "InvalidEnvError";
  }
}

export function parseServerEnv(
  source: Readonly<Record<string, string | undefined>>,
): ServerEnv {
  const result = serverEnvWithEmailSchema.safeParse(source);

  if (result.success) return result.data;

  const issues = result.error.issues
    .map((issue) => issue.path.join("."))
    .join(", ");

  throw new InvalidEnvError(issues);
}

/** Only the product name, for metadata and screens that must not require the other secrets. */
export function getAppName(): string {
  const name = process.env.APP_NAME;

  if (name == null || name.trim().length === 0) return DEFAULT_APP_NAME;

  return name.trim();
}

let cachedEnv: ServerEnv | null = null;

/** Parsed lazily so `next build` does not need runtime secrets. */
export function getServerEnv(): ServerEnv {
  if (cachedEnv != null) return cachedEnv;

  cachedEnv = parseServerEnv(process.env);

  return cachedEnv;
}
