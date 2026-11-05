"use client";

import { Trash2 } from "lucide-react";
import { type FormEvent, type ReactElement, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VideoLimit } from "@/features/studio/domain/quota";
import type { VideoProvider } from "@/features/video-ai/providers";
import { SAMPLE_VIDEO_CHOICE } from "@/features/video-ai/providers";
import { useIsClient } from "@/lib/use-is-client";
import {
  chooseVideoAi,
  removeVideoProviderKey,
  saveVideoLimitSettings,
  saveVideoProviderKey,
} from "../video-ai-actions";

const SELECT_CLASS =
  "h-11 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground";

const PERIOD_OPTIONS = [
  { value: "day", label: "dia" },
  { value: "week", label: "semana" },
  { value: "month", label: "mês" },
] as const;

export function VideoLimitForm(props: { limit: VideoLimit }): ReactElement {
  const [isPending, startTransition] = useTransition();
  const isReady = useIsClient();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveVideoLimitSettings({
        count: data.get("count"),
        period: data.get("period"),
      });

      if (result.ok === false) {
        toast.error(result.message);
        return;
      }

      toast.success("Limite de vídeos salvo");
    });
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2"
    >
      <Input
        type="number"
        name="count"
        min={0}
        step={1}
        inputMode="numeric"
        defaultValue={props.limit.count}
        aria-label="Quantidade de vídeos"
        className="h-11 w-24 text-base"
      />
      <span className="text-sm">vídeos por</span>
      <select
        name="period"
        aria-label="Período do limite"
        defaultValue={props.limit.period}
        className={SELECT_CLASS}
      >
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button
        type="submit"
        variant="outline"
        className="h-11 sm:ml-auto"
        disabled={isReady === false || isPending}
      >
        {isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}

export interface ModelOption {
  /** "provider:model". */
  readonly value: string;
  readonly label: string;
}

export function VideoAiPicker(props: {
  options: readonly ModelOption[];
  current: string;
}): ReactElement {
  const [isPending, startTransition] = useTransition();
  const isReady = useIsClient();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const choice = new FormData(event.currentTarget).get("choice");

    startTransition(async () => {
      const result = await chooseVideoAi({ choice });

      if (result.ok === false) {
        toast.error(result.message);
        return;
      }

      toast.success("IA de vídeo escolhida");
    });
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <select
        name="choice"
        aria-label="IA que cria os vídeos"
        defaultValue={props.current}
        className={`${SELECT_CLASS} flex-1`}
      >
        <option value={SAMPLE_VIDEO_CHOICE}>
          Vídeo de exemplo (não gasta nada)
        </option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button
        type="submit"
        variant="outline"
        className="h-11"
        disabled={isReady === false || isPending}
      >
        {isPending ? "Salvando…" : "Usar esta"}
      </Button>
    </form>
  );
}

/** The service's first letter, in place of a logo. */
function ProviderLogo(props: { provider: VideoProvider }): ReactElement {
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-medium"
    >
      {props.provider.name.charAt(0)}
    </span>
  );
}

export function ProviderKeyRow(props: {
  provider: VideoProvider;
  savedLabel: string | null;
}): ReactElement {
  const [isPending, startTransition] = useTransition();
  // Only after JavaScript runs, so the browser never sends the key in the page address.
  const isReady = useIsClient();
  const { provider } = props;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const key = new FormData(form).get("key");

    startTransition(async () => {
      const result = await saveVideoProviderKey({
        provider: provider.id,
        key,
      });

      if (result.ok === false) {
        toast.error(result.message);
        return;
      }

      form.reset();
      toast.success(`Chave do ${provider.name} salva`);
    });
  }

  function handleRemove(): void {
    const confirmed = window.confirm(
      `Tirar a chave do ${provider.name}? Se ele estiver em uso, o Studio volta para o vídeo de exemplo.`,
    );

    if (confirmed === false) return;

    startTransition(async () => {
      const result = await removeVideoProviderKey({ provider: provider.id });

      if (result.ok === false) {
        toast.error(result.message);
        return;
      }

      toast.success(`Chave do ${provider.name} tirada`);
    });
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <ProviderLogo provider={provider} />
        <span className="font-medium">{provider.name}</span>
        {props.savedLabel == null ? (
          <Badge variant="outline">Sem chave</Badge>
        ) : (
          <Badge variant="secondary">{props.savedLabel}</Badge>
        )}
        {props.savedLabel != null && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-11"
            aria-label={`Tirar a chave do ${provider.name}`}
            disabled={isPending}
            onClick={handleRemove}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
      </div>
      <form
        method="post"
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <Input
          type="password"
          name="key"
          autoComplete="off"
          aria-label={`Chave do ${provider.name}`}
          placeholder={
            props.savedLabel == null ? "Cole a chave" : "Cole a chave nova"
          }
          className="h-11 flex-1 text-base"
        />
        <Button
          type="submit"
          variant="outline"
          className="h-11"
          disabled={isReady === false || isPending}
        >
          {props.savedLabel == null ? "Salvar" : "Trocar"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">{provider.keyHelp}</p>
    </li>
  );
}
