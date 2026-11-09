import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CollectionCard } from "./stat-cards";

describe("CollectionCard", () => {
  it("não deve prometer uma coleta de anúncios que não tem fonte para rodar", () => {
    const html = renderToStaticMarkup(
      createElement(CollectionCard, { kind: "ads", run: null }),
    );

    expect(html).toContain("Ainda não há fonte automática de anúncios");
    expect(html).not.toContain("depois da primeira coleta");
  });

  it("deve avisar que a coleta de produtos aparece depois da primeira", () => {
    const html = renderToStaticMarkup(
      createElement(CollectionCard, { kind: "products", run: null }),
    );

    expect(html).toContain("Aparece aqui depois da primeira coleta.");
  });
});
