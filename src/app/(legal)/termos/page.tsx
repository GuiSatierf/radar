import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactElement } from "react";
import { LegalDocumentView } from "@/features/legal/components/legal-document-view";
import { buildTerms } from "@/features/legal/documents";
import { getLegalContact } from "@/features/legal/legal-contact";
import { LEGAL_UPDATED_AT, PRIVACY_PATH } from "@/features/legal/legal-info";
import { getAppName } from "@/lib/env";

export const metadata: Metadata = { title: "Termos de uso" };

export default async function TermsPage(): Promise<ReactElement> {
  // Rendered on request: the app name and the support link come from the running environment.
  await connection();

  return (
    <LegalDocumentView
      document={buildTerms(getAppName())}
      updatedAt={LEGAL_UPDATED_AT}
      contact={getLegalContact()}
      otherDocument={{ href: PRIVACY_PATH, label: "Política de privacidade" }}
    />
  );
}
