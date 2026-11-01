"use client";

import { type ReactElement, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/features/radar/components/product-image";
import { cn } from "@/lib/utils";
import { createVideo } from "../actions";
import {
  DEFAULT_VIDEO_FORMAT,
  VIDEO_FORMAT_TEXT,
  VIDEO_FORMATS,
  type VideoFormat,
} from "../domain/formats";
import type { StudioProduct } from "../queries";
import { describeStudioProduct, ProductPicker } from "./product-picker";

function PickedProduct(props: {
  product: StudioProduct | null;
  onChange: () => void;
}): ReactElement {
  const { product } = props;

  if (product == null) {
    return (
      <Button
        variant="outline"
        className="h-14 w-full justify-start px-4"
        onClick={props.onChange}
      >
        Escolher produto
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-2">
      <div aria-hidden>
        <ProductImage
          url={product.imageUrl}
          alt=""
          sizes="44px"
          className="size-11 shrink-0 rounded-lg"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          Você ganha {describeStudioProduct(product)}
        </p>
      </div>
      <Button variant="outline" className="h-11 px-3" onClick={props.onChange}>
        Trocar<span className="sr-only"> o produto</span>
      </Button>
    </div>
  );
}

function FormatOption(props: {
  format: VideoFormat;
  checked: boolean;
  onSelect: (format: VideoFormat) => void;
}): ReactElement {
  const text = VIDEO_FORMAT_TEXT[props.format];

  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 has-focus-visible:outline-2 has-focus-visible:outline-ring",
        props.checked ? "border-primary bg-accent" : "border-border",
      )}
    >
      <input
        type="radio"
        name="format"
        value={props.format}
        checked={props.checked}
        onChange={() => props.onSelect(props.format)}
        className="mt-0.5 size-4 accent-primary"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{text.label}</span>
        <span className="text-xs text-muted-foreground">
          {text.description}
        </span>
      </span>
    </label>
  );
}

/**
 * Step 1 picks the product, step 2 the format, then "Gerar vídeo". The button only waits on the
 * screen; the server checks the plan, the monthly limit and the one-at-a-time rule again.
 */
export function CreateVideoForm(props: {
  product: StudioProduct | null;
  suggestions: readonly StudioProduct[];
  /** Why no video can be made right now (limit reached, one being made), or null. */
  blockedMessage: string | null;
}): ReactElement {
  const [format, setFormat] = useState<VideoFormat>(DEFAULT_VIDEO_FORMAT);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { product } = props;
  const message = props.blockedMessage ?? error;
  const isDisabled =
    product == null || props.blockedMessage != null || isPending;

  function handleGenerate(): void {
    if (product == null) return;

    setError(null);
    startTransition(async () => {
      try {
        const result = await createVideo({ productId: product.id, format });

        if (result.ok === false) {
          setError(result.message);

          return;
        }

        toast.success(
          "Seu vídeo começou a ser feito. Ele aparece em Seus vídeos.",
        );
      } catch {
        setError("Não deu para começar o vídeo agora. Tente de novo.");
      }
    });
  }

  return (
    <section
      aria-labelledby="create-title"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4"
    >
      <h2 id="create-title" className="text-base font-semibold">
        Criar vídeo
      </h2>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">1 · Produto</p>
        <PickedProduct product={product} onChange={() => setPickerOpen(true)} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-medium text-muted-foreground">
          2 · Formato
        </legend>
        {VIDEO_FORMATS.map((option) => (
          <FormatOption
            key={option}
            format={option}
            checked={format === option}
            onSelect={setFormat}
          />
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <p
          id="generate-message"
          aria-live="polite"
          className={cn(
            "text-sm",
            message == null ? "sr-only" : "rounded-xl bg-muted p-3",
          )}
        >
          {message}
        </p>
        <Button
          className="h-11 w-full"
          disabled={isDisabled}
          aria-describedby="generate-message generate-hint"
          onClick={handleGenerate}
        >
          {isPending ? "Começando…" : "Gerar vídeo"}
        </Button>
        <p id="generate-hint" className="text-xs text-muted-foreground">
          {product == null
            ? "Escolha um produto para liberar o botão."
            : "Vertical, 8 segundos. Fica pronto em alguns minutos."}
        </p>
      </div>

      <ProductPicker
        open={isPickerOpen}
        onOpenChange={setPickerOpen}
        suggestions={props.suggestions}
      />
    </section>
  );
}
