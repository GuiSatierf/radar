export const TERMS_PATH = "/termos";
export const PRIVACY_PATH = "/privacidade";

/** The day the texts last changed (UTC). Bump it with every change to the terms or the policy. */
export const LEGAL_UPDATED_AT = "2026-10-23";

export interface LegalEntity {
  readonly name: string | null;
  // CNPJ, as the client writes it.
  readonly document: string | null;
  readonly privacyEmail: string | null;
}

/**
 * Who runs the service. Provisional until the client sends the company details: while a field
 * is null, the pages leave it out instead of inventing it.
 */
export const LEGAL_ENTITY: LegalEntity = {
  name: null,
  document: null,
  privacyEmail: null,
};

/** Where the pages send questions about the texts and the data. */
export interface LegalContact {
  readonly email: string | null;
  readonly supportUrl: string | undefined;
}
