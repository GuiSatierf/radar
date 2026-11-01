import { describe, expect, it } from "vitest";
import {
  createResendEmailSender,
  EmailDeliveryError,
  RESEND_ENDPOINT,
} from "./resend-email-sender";
import { selectEmailSender } from "./select-email-sender";

const API_KEY = "re_chave_de_teste";
const FROM = "Prisciane <nao-responda@exemplo.com.br>";
const MESSAGE = {
  to: "maria@exemplo.com",
  subject: "Crie uma senha nova",
  text: "Abra o link para criar a senha nova.",
};

interface Captured {
  url: string;
  init: RequestInit;
}

function fakeFetch(response: Response | Error): {
  fetch: typeof fetch;
  calls: Captured[];
} {
  const calls: Captured[] = [];
  const fetchFn = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({ url: String(url), init: init ?? {} });

    if (response instanceof Error) throw response;

    return response;
  };

  return { fetch: fetchFn as typeof fetch, calls };
}

function sender(fetchFn: typeof fetch) {
  return createResendEmailSender({
    apiKey: API_KEY,
    from: FROM,
    fetch: fetchFn,
  });
}

describe("createResendEmailSender", () => {
  it("deve mandar o e-mail para a API do Resend com a chave e o remetente", async () => {
    const fake = fakeFetch(Response.json({ id: "email-1" }));

    await sender(fake.fetch).send(MESSAGE);

    const [call] = fake.calls;
    const headers = new Headers(call?.init.headers);

    expect(call?.url).toBe(RESEND_ENDPOINT);
    expect(call?.init.method).toBe("POST");
    expect(headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(JSON.parse(String(call?.init.body))).toEqual({
      from: FROM,
      to: [MESSAGE.to],
      subject: MESSAGE.subject,
      text: MESSAGE.text,
    });
    expect(call?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("deve falhar com o motivo do Resend, sem a chave na mensagem", async () => {
    const fake = fakeFetch(
      Response.json(
        { name: "validation_error", message: "domain not verified" },
        { status: 403 },
      ),
    );

    const send = sender(fake.fetch).send(MESSAGE);

    await expect(send).rejects.toBeInstanceOf(EmailDeliveryError);
    await expect(send).rejects.toMatchObject({ status: 403 });
    await expect(send).rejects.toThrow("validation_error");
    await expect(send).rejects.not.toThrow(API_KEY);
  });

  it("deve usar o código HTTP quando a resposta de erro não é JSON", async () => {
    const fake = fakeFetch(new Response("Bad Gateway", { status: 502 }));

    await expect(sender(fake.fetch).send(MESSAGE)).rejects.toThrow("HTTP 502");
  });

  it("deve virar erro de envio quando a rede falha ou demora demais", async () => {
    const fake = fakeFetch(new DOMException("timeout", "TimeoutError"));

    const send = sender(fake.fetch).send(MESSAGE);

    await expect(send).rejects.toBeInstanceOf(EmailDeliveryError);
    await expect(send).rejects.toMatchObject({ status: null });
  });
});

describe("selectEmailSender", () => {
  it("deve ficar desligado sem caixa de saída e sem Resend", () => {
    expect(selectEmailSender({})).toBeNull();
    expect(selectEmailSender({ RESEND_API_KEY: API_KEY })).toBeNull();
  });

  it("deve usar o Resend quando a chave e o remetente existem", () => {
    expect(
      selectEmailSender({ RESEND_API_KEY: API_KEY, EMAIL_FROM: FROM })?.name,
    ).toBe("resend");
  });

  it("deve preferir a caixa de saída local, para os testes nunca mandarem e-mail", () => {
    const chosen = selectEmailSender({
      EMAIL_OUTBOX_DIR: ".outbox",
      RESEND_API_KEY: API_KEY,
      EMAIL_FROM: FROM,
    });

    expect(chosen?.name).toBe("outbox");
  });
});
