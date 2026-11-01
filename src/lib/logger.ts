import pino from "pino";
import { resolveLogLevel } from "@/lib/env";

// Never log secrets or personal data; these paths are dropped even if passed by mistake.
const REDACTED_PATHS = [
  "password",
  "*.password",
  "email",
  "*.email",
  "token",
  "*.token",
  "headers.cookie",
  "headers.authorization",
];

export const logger = pino({
  level: resolveLogLevel(process.env.LOG_LEVEL),
  redact: { paths: REDACTED_PATHS, remove: true },
  base: { app: "prisciane" },
});
