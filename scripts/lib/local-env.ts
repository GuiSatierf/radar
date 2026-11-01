const SECRET_PLACEHOLDER = "replace-me-with-at-least-32-random-characters";
const BLANK_ADMIN_EMAIL = 'ADMIN_EMAIL=""';
const DEMO_EMAIL_LINE = /^SEED_DEMO_EMAIL="([^"]+)"/m;

/**
 * Turns .env.example into a local .env: a random secret, and the demo account as admin.
 * .env.example keeps ADMIN_EMAIL blank on purpose: an environment copied from it must never make
 * the publicly known demo e-mail an admin.
 */
export function buildLocalEnv(example: string, secret: string): string {
  const withSecret = example.replace(SECRET_PLACEHOLDER, secret);
  const demoEmail = DEMO_EMAIL_LINE.exec(withSecret)?.[1];

  if (demoEmail == null) return withSecret;

  return withSecret.replace(BLANK_ADMIN_EMAIL, `ADMIN_EMAIL="${demoEmail}"`);
}
