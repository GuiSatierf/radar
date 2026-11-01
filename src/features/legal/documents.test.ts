import { describe, expect, it } from "vitest";
import {
  buildPrivacyPolicy,
  buildTerms,
  describeController,
  type LegalDocument,
} from "./documents";

const APP_NAME = "Nome do App";
const DOCUMENTS: readonly LegalDocument[] = [
  buildTerms(APP_NAME),
  buildPrivacyPolicy(APP_NAME, "a equipe do Nome do App"),
];

function allText(document: LegalDocument): string {
  const sections = document.sections.flatMap((section) => [
    section.title,
    ...section.paragraphs,
    ...(section.items ?? []),
  ]);

  return [document.title, document.intro, ...sections].join("\n");
}

describe("textos legais", () => {
  it.each(DOCUMENTS)("deve ter texto em toda seção de $title", (document) => {
    for (const section of document.sections) {
      const lines = [...section.paragraphs, ...(section.items ?? [])];

      expect(section.title.trim()).not.toBe("");
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.every((line) => line.trim().length > 0)).toBe(true);
    }
  });

  it.each(DOCUMENTS)(
    "deve usar o nome do produto, sem siglas, em $title",
    (document) => {
      const text = allText(document);

      expect(text).toContain(APP_NAME);
      expect(text).not.toMatch(/\b(LGPD|ANPD|CDC|DPO|CNPJ)\b/);
    },
  );

  it("não deve repetir o título de uma seção no mesmo texto", () => {
    for (const document of DOCUMENTS) {
      const titles = document.sections.map((section) => section.title);

      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});

describe("describeController", () => {
  const empty = { name: null, document: null, privacyEmail: null };

  it("deve falar da equipe enquanto o cliente não manda os dados da empresa", () => {
    expect(describeController(empty, APP_NAME)).toBe("a equipe do Nome do App");
  });

  it("deve mostrar a empresa e o CNPJ quando os dois existem", () => {
    const entity = {
      ...empty,
      name: "Empresa Ltda",
      document: "00.000.000/0001-00",
    };

    expect(describeController(entity, APP_NAME)).toBe(
      "Empresa Ltda, CNPJ 00.000.000/0001-00",
    );
    expect(describeController({ ...entity, document: null }, APP_NAME)).toBe(
      "Empresa Ltda",
    );
  });
});
