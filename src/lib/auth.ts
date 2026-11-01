import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { type Database, getDatabase } from "@/db/client";
import * as schema from "@/db/schema";
import { syncAccountPlan } from "@/features/billing/access";
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
import type { EmailMessage, EmailSender } from "@/sources/email/email-sender";
import { selectEmailSender } from "@/sources/email/select-email-sender";
import {
  buildEmailVerificationEmail,
  VERIFICATION_LINK_HOURS,
} from "./email-verification-email";

const SESSION_DAYS = 30;
const SECONDS_PER_DAY = 60 * 60 * 24;
const SECONDS_PER_HOUR = 60 * 60;
const SIGN_UP_PATH = "/sign-up/email";
const VERIFY_PASSWORD_PATH = "/verify-password";
const SEND_VERIFICATION_PATH = "/send-verification-email";
// "Reenviar e-mail" a few times is normal; more than that only fills someone's inbox.
const VERIFICATION_EMAILS_PER_MINUTE = 3;
const RATE_LIMIT_WINDOW_SECONDS = 60;

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

interface LinkRequest {
  user: { id: string; name: string; email: string };
  url: string;
}

type LinkEmailBuilder = (input: {
  appName: string;
  name: string;
  to: string;
  url: string;
}) => EmailMessage;

/**
 * The e-mail is not awaited on purpose: answering at the same speed whether the account exists
 * or not keeps the form from revealing who has an account. Failures go to the log.
 */
function sendLinkEmail(
  emailSender: EmailSender | null,
  appName: string,
  purpose: string,
  build: LinkEmailBuilder,
): (data: LinkRequest) => Promise<void> {
  return async ({ user, url }) => {
    if (emailSender == null) {
      logger.warn(
        { userId: user.id, purpose },
        "e-mail link requested, but no e-mail sender is configured",
      );
      return;
    }

    const message = build({ appName, name: user.name, to: user.email, url });

    void emailSender.send(message).catch((error: unknown) => {
      logger.error(
        { err: error, userId: user.id, purpose, sender: emailSender.name },
        "e-mail link failed",
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
      sendResetPassword: sendLinkEmail(
        deps.emailSender,
        env.APP_NAME,
        "password-reset",
        buildPasswordResetEmail,
      ),
      // A new password logs out every other device, in case someone else had the old one.
      revokeSessionsOnPasswordReset: true,
    },
    // Anyone can type someone else's e-mail at sign-up, so a plan bought on Hotmart or given by an
    // admin waits for the link: only the e-mail's owner can open it.
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: sendLinkEmail(
        deps.emailSender,
        env.APP_NAME,
        "email-verification",
        buildEmailVerificationEmail,
      ),
      autoSignInAfterVerification: true,
      expiresIn: VERIFICATION_LINK_HOURS * SECONDS_PER_HOUR,
      afterEmailVerification: async (verifiedUser) => {
        await syncAccountPlan(
          db,
          verifiedUser.email.trim().toLowerCase(),
          new Date(),
        );
      },
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
    rateLimit: {
      customRules: {
        [SEND_VERIFICATION_PATH]: {
          window: RATE_LIMIT_WINDOW_SECONDS,
          max: VERIFICATION_EMAILS_PER_MINUTE,
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
