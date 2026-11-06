import { describe, expect, it, vi } from "vitest";
import {
  createGeminiOmniVideoGenerator,
  GeminiVideoError,
} from "./gemini-omni-video-generator";
import { ProductPhotoError } from "./product-photo";
import type { VideoRequest } from "./video-generator";

const API_KEY = "teste-chave-gemini";
const MODEL = "gemini-omni-1.2-flash";
const PHOTO_URL = "https://loja.exemplo/foto.jpg";
const VIDEO_BYTES = new Uint8Array([0, 0, 0, 32, 102, 116, 121, 112]);
const VIDEO_BASE64 = Buffer.from(VIDEO_BYTES).toString("base64");

const REQUEST: VideoRequest = {
  productName: "Garrafa térmica",
  productImageUrl: PHOTO_URL,
  format: "hands",
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function finished(id = "v1_abc"): unknown {
  return {
    id,
    status: "completed",
    steps: [
      { type: "user_input", content: [{ type: "text", text: "..." }] },
      {
        type: "model_output",
        content: [
          { type: "video", mime_type: "video/mp4", data: VIDEO_BASE64 },
        ],
      },
    ],
  };
}

/** A fake Google: answers the photo, then the queued interaction responses in order. */
function fakeFetch(interactions: Response[]) {
  const queue = [...interactions];

  return vi.fn(
    async (
      input: string | URL | Request,
      _init?: RequestInit,
    ): Promise<Response> => {
      if (String(input) === PHOTO_URL) {
        return new Response(new Uint8Array([9, 9]), {
          headers: { "content-type": "image/png" },
        });
      }

      const next = queue.shift();

      if (next == null) throw new Error(`unexpected call to ${String(input)}`);

      return next;
    },
  );
}

function generatorWith(fetchImpl: typeof fetch, now: () => number = () => 0) {
  return createGeminiOmniVideoGenerator({
    apiKey: API_KEY,
    model: MODEL,
    fetchImpl,
    sleep: async () => {},
    now,
  });
}

function sentBody(fetchImpl: ReturnType<typeof fakeFetch>): {
  model: string;
  background?: boolean;
  input: { type: string; mime_type?: string; text?: string }[];
  generation_config: { video_config: { task: string } };
  response_format: Record<string, string>;
} {
  const call = fetchImpl.mock.calls.find(([url]) =>
    String(url).endsWith("/interactions"),
  );
  const init = call?.[1];

  return JSON.parse(String(init?.body));
}

describe("createGeminiOmniVideoGenerator", () => {
  it("deve devolver os bytes do vídeo quando a resposta já vem pronta", async () => {
    const fetchImpl = fakeFetch([json(finished())]);

    const result = await generatorWith(fetchImpl).generate(REQUEST);

    expect(result).toEqual({ kind: "file", bytes: VIDEO_BYTES });
  });

  it("deve mandar a foto, o texto e o formato vertical de 8 segundos com a chave no cabeçalho", async () => {
    const fetchImpl = fakeFetch([json(finished())]);

    await generatorWith(fetchImpl).generate(REQUEST);
    const body = sentBody(fetchImpl);
    const init = fetchImpl.mock.calls[1]?.[1] ?? {};

    expect(body.model).toBe(MODEL);
    expect(body.input[0]).toMatchObject({
      type: "image",
      mime_type: "image/png",
    });
    expect(body.input[1]?.text).toContain("Garrafa térmica");
    expect(body.generation_config.video_config.task).toBe("image_to_video");
    expect(body.response_format).toMatchObject({
      aspect_ratio: "9:16",
      duration: "8s",
      resolution: "720p",
    });
    expect(new Headers(init.headers).get("x-goog-api-key")).toBe(API_KEY);
    expect(String(fetchImpl.mock.calls[1]?.[0])).not.toContain(API_KEY);
  });

  it("deve pedir o vídeo em segundo plano para a conexão não esperar o vídeo ficar pronto", async () => {
    const fetchImpl = fakeFetch([json(finished())]);

    await generatorWith(fetchImpl).generate(REQUEST);

    expect(sentBody(fetchImpl).background).toBe(true);
  });

  it("deve pedir vídeo só por texto quando o produto não tem foto", async () => {
    const fetchImpl = fakeFetch([json(finished())]);

    await generatorWith(fetchImpl).generate({
      ...REQUEST,
      productImageUrl: null,
    });
    const body = sentBody(fetchImpl);

    expect(body.input).toHaveLength(1);
    expect(body.generation_config.video_config.task).toBe("text_to_video");
  });

  it("deve consultar de novo até o vídeo ficar pronto", async () => {
    const fetchImpl = fakeFetch([
      json({ id: "v1_abc", status: "in_progress" }),
      json({ id: "v1_abc", status: "in_progress" }),
      json(finished()),
    ]);

    const result = await generatorWith(fetchImpl).generate(REQUEST);

    expect(result.kind).toBe("file");
    expect(String(fetchImpl.mock.calls.at(-1)?.[0])).toMatch(
      /\/interactions\/v1_abc$/,
    );
  });

  it("deve falhar com a mensagem do Google quando o vídeo dá erro", async () => {
    const fetchImpl = fakeFetch([
      json({
        id: "v1_abc",
        status: "failed",
        errors: [{ message: "prompt blocked" }],
      }),
    ]);

    await expect(generatorWith(fetchImpl).generate(REQUEST)).rejects.toThrow(
      "status failed: prompt blocked",
    );
  });

  it("deve falhar quando a resposta pronta não tem vídeo", async () => {
    const fetchImpl = fakeFetch([
      json({ id: "v1_abc", status: "completed", steps: [] }),
    ]);

    await expect(generatorWith(fetchImpl).generate(REQUEST)).rejects.toThrow(
      "the answer has no video",
    );
  });

  it("deve falhar com o código HTTP quando o Google recusa o pedido", async () => {
    const fetchImpl = fakeFetch([
      json({ error: { message: "API key not valid" } }, 400),
    ]);

    await expect(generatorWith(fetchImpl).generate(REQUEST)).rejects.toThrow(
      /create answered 400: .*API key not valid/,
    );
  });

  it("deve desistir quando passa do tempo limite", async () => {
    let clock = 0;
    const fetchImpl = fakeFetch(
      Array.from({ length: 5 }, () =>
        json({ id: "v1_abc", status: "in_progress" }),
      ),
    );
    const generator = generatorWith(fetchImpl, () => {
      clock += 5 * 60 * 1000;
      return clock;
    });

    await expect(generator.generate(REQUEST)).rejects.toThrow(
      "no video before the time limit",
    );
  });

  it("deve recusar resposta num formato desconhecido", async () => {
    const fetchImpl = fakeFetch([json({ unexpected: true })]);

    await expect(
      generatorWith(fetchImpl).generate(REQUEST),
    ).rejects.toBeInstanceOf(GeminiVideoError);
  });

  it("deve parar antes de chamar o Google quando a foto não serve", async () => {
    const fetchImpl = fakeFetch([]);

    await expect(
      generatorWith(fetchImpl).generate({
        ...REQUEST,
        productImageUrl: "http://loja.exemplo/foto.jpg",
      }),
    ).rejects.toBeInstanceOf(ProductPhotoError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
