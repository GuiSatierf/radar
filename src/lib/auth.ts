import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { type Database, getDatabase } from "@/db/client";
import * as schema from "@/db/schema";
import { effectivePlan } from "@/features/billing/access";
import { ADMIN_ROLE } from "@/features/plans/access";
import { DEFAULT_PLAN } from "@/features/plans/plans";
import { DEFAULT_COMMISSION_PROFILE } from "@/features/radar/domain/commission";
import {
  INVALID_SIGN_UP_CODE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signUpSchema,
} from "@/lib/auth-forms";
import { getServerEnv, type ServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { hashPassword, verifyPassword } from "@/lib/password";
import { buildPasswordResetEmail } from "@/lib/password-reset-email";
import type { EmailSender } from "@/sources/email/email-sender";
import { selectEmailSender } from "@/sources/email/select-email-sender";

const SESSION_DAYS = 30;
const SECONDS_PER_DAY = 60 * 60 * 24;
const SIGN_UP_PATH = "/sign-up/email";
const VERIFY_PASSWORD_PATH = "/verify-password";

type AuthEnv = Pick<
  ServerEnv,
  "APP_NAME" | "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL" | "CLIENT_IP_HEADER"
>;

/** The server never trusts the form: sign-up bodies get the same validation as the screen. */
const validateSignUp = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== SIGN_UP_PATH) return;

  const parsed = signUpSchema.safeParse(ctx.body);

  if (parsed.success) return;

  throw new APIError("BAD_REQUEST", {
    code: INVALID_SIGN_UP_CODE,
    message: parsed.error.issues[0]?.message ?? "Invalid sign-up data",
  });
});

interface ResetRequest {
  user: { id: string; name: string; email: string };
  url: string;
}

/**
 * The e-mail is not awaited on purpose: answering at the same speed whether the account exists
 * or not keeps the form from revealing who has an account. Failures go to the log.
 */
function sendPasswordReset(
  emailSender: EmailSender | null,
  appName: string,
): (data: ResetRequest) => Promise<void> {
  return async ({ user, url }) => {
    if (emailSender == null) {
      logger.warn(
        { userId: user.id },
        "password reset requested, but no e-mail sender is configured",
      );
      return;
    }

    const message = buildPasswordResetEmail({
      appName,
      name: user.name,
      to: user.email,
      url,
    });

    void emailSender.send(message).catch((error: unknown) => {
      logger.error(
        { err: error, userId: user.id, sender: emailSender.name },
        "password reset e-mail failed",
      );
    });
  };
}

export function createAuth(
  db: Database,
  env: AuthEnv,
  deps: { emailSender: EmailSender | null } = { emailSender: null },
) {
  return betterAuth({
    appName: env.APP_NAME,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
      sendResetPassword: sendPasswordReset(deps.emailSender, env.APP_NAME),
      // A new password logs out every other device, in case someone else had the old one.
      revokeSessionsOnPasswordReset: true,
    },
    session: {
      expiresIn: SESSION_DAYS * SECONDS_PER_DAY,
    },
    user: {
      additionalFields: {
        // Changed only through the settings page action, never from the sign-up body.
        commissionProfile: {
          type: "number",
          required: false,
          defaultValue: DEFAULT_COMMISSION_PROFILE,
          input: false,
        },
        // Changed only by an admin (src/features/admin/actions.ts), never by the user.
        plan: {
          type: "string",
          required: false,
          defaultValue: DEFAULT_PLAN,
          input: false,
        },
      },
    },
    // The app never calls it, and it checks a password (argon2id) under the loose generic rate
    // limit instead of the strict sign-in one: any account could load the server through it.
    disabledPaths: [VERIFY_PASSWORD_PATH],
    hooks: { before: validateSignUp },
    databaseHooks: {
      user: {
        create: {
          // Bought on Hotmart before signing up: the account starts with that plan.
          before: async (newUser) => {
            const email = newUser.email.trim().toLowerCase();
            const plan = await effectivePlan(db, email, new Date());

            return { data: { ...newUser, plan } };
          },
        },
      },
    },
    advanced: {
      // Rate limiting keys on the client IP. Use a header the reverse proxy overwrites
      // (x-real-ip on Traefik), never one the client can forge.
      ipAddress: { ipAddressHeaders: [env.CLIENT_IP_HEADER] },
    },
    plugins: [
      // Roles, blocking and the user list. Nobody becomes admin through the app: the role is
      // granted at startup to the e-mail in ADMIN_EMAIL (scripts/start.mjs).
      admin({ defaultRole: "user", adminRoles: [ADMIN_ROLE] }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let cachedAuth: Auth | null = null;

export function getAuth(): Auth {
  if (cachedAuth != null) return cachedAuth;

  const env = getServerEnv();
  cachedAuth = createAuth(getDatabase(), env, {
    emailSender: selectEmailSender(env),
  });

  return cachedAuth;
}
