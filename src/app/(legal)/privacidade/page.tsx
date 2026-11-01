import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactElement } from "react";
import { LegalDocumentView } from "@/features/legal/components/legal-document-view";
import {
  buildPrivacyPolicy,
  describeController,
} from "@/features/legal/documents";
import { getLegalContact } from "@/features/legal/legal-contact";
import {
  LEGAL_ENTITY,
  LEGAL_UPDATED_AT,
  TERMS_PATH,
} from "@/features/legal/legal-info";
import { getAppName } from "@/lib/env";

export const metadata: Metadata = { title: "Política de privacidade" };

export default async function PrivacyPage(): Promise<ReactElement> {
  // Rendered on request: the app name and the support link come from the running environment.
  await connection();

  const appName = getAppName();
  const controller = describeController(LEGAL_ENTITY, appName);

  return (
    <LegalDocumentView
      document={buildPrivacyPolicy(appName, controller)}
      updatedAt={LEGAL_UPDATED_AT}
      contact={getLegalContact()}
      otherDocument={{ href: TERMS_PATH, label: "Termos de uso" }}
    />
  );
}
