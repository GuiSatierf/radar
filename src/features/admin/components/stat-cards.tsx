import type { ReactElement, ReactNode } from "react";
import { formatInteger, formatUpdatedAt } from "@/features/radar/domain/format";
import { cn } from "@/lib/utils";
import type { CollectionKind } from "@/sources/record-run";
import type { LastCollection } from "../queries";

export function StatCard(props: {
  title: string;
  value: string;
  className?: string;
  children?: ReactNode;
}): ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-border p-4",
        props.className,
      )}
    >
      <p className="text-sm text-muted-foreground">{props.title}</p>
      <p className="text-xl font-semibold">{props.value}</p>
      {props.children}
    </div>
  );
}

const COLLECTION_TEXT: Readonly<
  Record<
    CollectionKind,
    {
      title: string;
      items: string;
      whenFailed: string;
      /** Shown before any run; the ad collection has no real source yet, so it may never run. */
      whenNone: string;
      /** Source names with their article ("do catálogo…"), as the sentence needs. */
      sources: Readonly<Record<string, string>>;
    }
  >
> = {
  products: {
    title: "Última coleta de produtos",
    items: "produtos",
    whenFailed: "Falhou, e o Radar continua com os produtos anteriores.",
    whenNone: "Aparece aqui depois da primeira coleta.",
    sources: {
      fake: "do catálogo de exemplo",
      "shopee-affiliate": "da API de afiliados da Shopee",
    },
  },
  ads: {
    title: "Última coleta automática de anúncios",
    items: "anúncios",
    whenFailed: "Falhou, e a lista de anúncios continua como estava.",
    whenNone:
      "Ainda não há fonte automática de anúncios. Os anúncios vêm só do que é cadastrado aqui no admin.",
    sources: { fake: "da fonte de exemplo" },
  },
};

/** When a collection last ran and whether it worked; the error text helps whoever fixes it. */
export function CollectionCard(props: {
  kind: CollectionKind;
  run: LastCollection | null;
  className?: string;
}): ReactElement {
  const text = COLLECTION_TEXT[props.kind];

  if (props.run == null) {
    return (
      <StatCard
        title={text.title}
        value="Nenhuma ainda"
        className={props.className}
      >
        <p className="text-sm text-muted-foreground">{text.whenNone}</p>
      </StatCard>
    );
  }

  const source = text.sources[props.run.source] ?? `de ${props.run.source}`;

  return (
    <StatCard
      title={text.title}
      value={formatUpdatedAt(props.run.finishedAt)}
      className={props.className}
    >
      {props.run.isOk ? (
        <p className="text-sm text-muted-foreground">
          Deu certo: {formatInteger(props.run.saved)} {text.items} {source}.
        </p>
      ) : (
        <p className="text-sm text-destructive">
          {text.whenFailed}
          <span className="mt-1 block break-words font-mono text-xs">
            {props.run.errorMessage}
          </span>
        </p>
      )}
    </StatCard>
  );
}
