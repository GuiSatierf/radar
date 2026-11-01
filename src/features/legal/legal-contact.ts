import { getServerEnv } from "@/lib/env";
import { LEGAL_ENTITY, type LegalContact } from "./legal-info";

/** The privacy e-mail once the client sends one; the support link until then. */
export function getLegalContact(): LegalContact {
  return {
    email: LEGAL_ENTITY.privacyEmail,
    supportUrl: getServerEnv().SUPPORT_URL,
  };
}
