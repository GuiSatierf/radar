import { describe, expect, it, vi } from "vitest";
import {
  downloadProductPhoto,
  MAX_PHOTO_BYTES,
  ProductPhotoError,
} from "./product-photo";

const PHOTO_URL = "https://loja.exemplo/foto.jpg";

function photoResponse(
  body: Uint8Array<ArrayBuffer>,
  contentType: string,
): Response {
  return new Response(body, { headers: { "content-type": contentType } });
}

describe("downloadProductPhoto", () => {
  it("deve devolver a foto em base64 com o tipo", async () => {
    const fetchImpl = vi.fn(async () =>
      photoResponse(new Uint8Array([1, 2, 3]), "image/jpeg; charset=binary"),
    );

    const photo = await downloadProductPhoto(PHOTO_URL, fetchImpl);

    expect(photo).toEqual({ base64: "AQID", mimeType: "image/jpeg" });
    expect(fetchImpl).toHaveBeenCalledWith(PHOTO_URL, expect.anything());
  });

  it("deve recusar endereço sem https sem buscar nada", async () => {
    const fetchImpl = vi.fn();

    await expect(
      downloadProductPhoto("http://loja.exemplo/foto.jpg", fetchImpl),
    ).rejects.toBeInstanceOf(ProductPhotoError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("deve recusar quando a loja responde com erro", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));

    await expect(downloadProductPhoto(PHOTO_URL, fetchImpl)).rejects.toThrow(
      "answered 404",
    );
  });

  it("deve recusar arquivo que não é imagem", async () => {
    const fetchImpl = vi.fn(async () =>
      photoResponse(new Uint8Array([1]), "text/html"),
    );

    await expect(downloadProductPhoto(PHOTO_URL, fetchImpl)).rejects.toThrow(
      "not a JPEG, PNG or WebP",
    );
  });

  it("deve recusar foto vazia", async () => {
    const fetchImpl = vi.fn(async () =>
      photoResponse(new Uint8Array([]), "image/png"),
    );

    await expect(downloadProductPhoto(PHOTO_URL, fetchImpl)).rejects.toThrow(
      "0 bytes",
    );
  });

  it("deve recusar foto maior que 7 MB", async () => {
    const fetchImpl = vi.fn(async () =>
      photoResponse(new Uint8Array(MAX_PHOTO_BYTES + 1), "image/webp"),
    );

    await expect(downloadProductPhoto(PHOTO_URL, fetchImpl)).rejects.toThrow(
      `more than ${MAX_PHOTO_BYTES} bytes`,
    );
  });

  it("deve parar de baixar assim que a foto sem tamanho informado passa de 7 MB", async () => {
    const CHUNK_BYTES = 1024 * 1024;
    const TOTAL_CHUNKS = 50;
    let chunksRead = 0;
    const endlessPhoto = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunksRead === TOTAL_CHUNKS) {
          controller.close();
          return;
        }

        chunksRead += 1;
        controller.enqueue(new Uint8Array(CHUNK_BYTES));
      },
    });
    const fetchImpl = vi.fn(
      async () =>
        new Response(endlessPhoto, {
          headers: { "content-type": "image/jpeg" },
        }),
    );

    await expect(
      downloadProductPhoto(PHOTO_URL, fetchImpl),
    ).rejects.toBeInstanceOf(ProductPhotoError);

    expect(chunksRead).toBeLessThan(TOTAL_CHUNKS / 2);
  });
});
