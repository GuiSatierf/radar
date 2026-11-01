import {
  Clapperboard,
  Download,
  LoaderCircle,
  Play,
  TriangleAlert,
} from "lucide-react";
import type { ReactElement } from "react";
import { ProductImage } from "@/features/radar/components/product-image";
import { VIDEO_FORMAT_TEXT } from "../domain/formats";
import { describeVideoDay, videoFileName } from "../domain/library";
import type { LibraryVideo } from "../queries";
import { VIDEO_KEEP_DAYS } from "../queue";

function VideoPreview(props: { video: LibraryVideo }): ReactElement {
  const { video } = props;

  if (video.status === "ready" && video.videoUrl != null) {
    // A link instead of an embedded player: the phone opens its own player, full screen.
    return (
      <a
        href={video.videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
      >
        {/* The link text says it all; the photo and the label only repeat it for the eyes. */}
        <div aria-hidden>
          <ProductImage
            url={video.productImageUrl}
            alt=""
            sizes="(min-width: 640px) 160px, 45vw"
            className="aspect-[9/16] w-full rounded-xl"
          />
          <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium">
            Pronto
          </span>
        </div>
        <span className="absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full bg-background/90 text-foreground group-hover:bg-background">
          <Play className="size-5" aria-hidden />
        </span>
        <span className="sr-only">Assistir o vídeo de {video.productName}</span>
      </a>
    );
  }

  if (video.status === "failed") {
    return (
      <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 rounded-xl bg-muted p-3 text-center text-xs text-muted-foreground">
        <TriangleAlert className="size-5" aria-hidden />
        Não deu certo. Este vídeo não gastou da sua conta.
      </div>
    );
  }

  return (
    <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 rounded-xl bg-muted p-3 text-center text-xs text-muted-foreground">
      <LoaderCircle
        className="size-5 animate-spin motion-reduce:animate-none"
        aria-hidden
      />
      {video.status === "queued" ? "Na fila…" : "Gerando…"} pode sair desta
      tela.
    </div>
  );
}

function VideoCard(props: { video: LibraryVideo; now: Date }): ReactElement {
  const { video } = props;
  const format = VIDEO_FORMAT_TEXT[video.format].label;

  return (
    <li className="flex min-w-0 flex-col gap-2">
      <VideoPreview video={video} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-sm font-medium">{video.productName}</p>
        <p className="text-xs text-muted-foreground">
          {format} · {describeVideoDay(video.createdAt, props.now)}
        </p>
      </div>
      {video.status === "ready" && video.videoUrl != null && (
        <a
          href={video.videoUrl}
          download={videoFileName(video.productName)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          <Download className="size-4" aria-hidden />
          Baixar
          <span className="sr-only"> o vídeo de {video.productName}</span>
        </a>
      )}
    </li>
  );
}

/** The person's videos: being made, ready to download, or failed (which cost nothing). */
export function VideoLibrary(props: {
  videos: readonly LibraryVideo[];
  now: Date;
}): ReactElement {
  return (
    <section
      aria-labelledby="library-title"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <h2 id="library-title" className="text-base font-semibold">
        Seus vídeos
      </h2>

      {props.videos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Clapperboard className="size-5" aria-hidden />
          </div>
          <p className="font-medium">Nenhum vídeo ainda</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Escolha um produto e um formato. O vídeo aparece aqui quando ficar
            pronto.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {props.videos.map((video) => (
            <VideoCard key={video.id} video={video} now={props.now} />
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Os vídeos ficam aqui por {VIDEO_KEEP_DAYS} dias. Baixe os que quiser
        guardar.
      </p>
    </section>
  );
}
