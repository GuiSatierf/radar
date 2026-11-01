"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactElement,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAd } from "../actions";
import {
  AD_PLATFORM_LABEL,
  AD_PLATFORMS,
  type AdPlatform,
} from "../domain/ads";
import type { AdFieldErrors, AdFormInput } from "../form-schema";

const ADMIN_ADS_PATH = "/admin/anuncios";

function FieldError(props: {
  id: string;
  message?: string;
}): ReactElement | null {
  if (props.message == null) return null;

  return (
    <p id={props.id} className="text-sm text-destructive">
      {props.message}
    </p>
  );
}

function TextField(props: {
  name: keyof AdFormInput;
  label: string;
  hint?: string;
  type?: string;
  defaultValue: string;
  error?: string;
}): ReactElement {
  const errorId = `${props.name}-erro`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={props.name}>{props.label}</Label>
      {props.hint != null && (
        <p className="text-xs text-muted-foreground">{props.hint}</p>
      )}
      <Input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        aria-invalid={props.error != null}
        aria-describedby={props.error == null ? undefined : errorId}
        className="h-11 text-base sm:text-sm"
      />
      <FieldError id={errorId} message={props.error} />
    </div>
  );
}

function readForm(form: HTMLFormElement): AdFormInput {
  const data = new FormData(form);
  const text = (name: keyof AdFormInput) => {
    const value = data.get(name);

    return typeof value === "string" ? value : "";
  };

  return {
    libraryLink: text("libraryLink"),
    advertiserName: text("advertiserName"),
    adText: text("adText"),
    startedOn: text("startedOn"),
    productLink: text("productLink"),
    platforms: data
      .getAll("platforms")
      .filter((value): value is AdPlatform =>
        AD_PLATFORMS.some((platform) => platform === value),
      ),
  };
}

/** Add or edit a curated ad. The server checks everything again (src/features/ads/actions.ts). */
export function AdForm(props: {
  editingId: number | null;
  defaults: AdFormInput;
}): ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<AdFieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const input = readForm(event.currentTarget);

    startTransition(async () => {
      const result = await saveAd(input, props.editingId);

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }

      setErrors({});
      toast.success(
        props.editingId == null ? "Anúncio cadastrado." : "Anúncio salvo.",
      );
      router.push(ADMIN_ADS_PATH);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex max-w-2xl flex-col gap-5"
    >
      <TextField
        name="libraryLink"
        label="Link do anúncio na biblioteca da Meta"
        hint="Abra o anúncio em facebook.com/ads/library e copie o endereço."
        type="url"
        defaultValue={props.defaults.libraryLink}
        error={errors.libraryLink}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="advertiserName"
          label="Quem anuncia"
          defaultValue={props.defaults.advertiserName}
          error={errors.advertiserName}
        />
        <TextField
          name="startedOn"
          label="No ar desde"
          hint="A data de “Veiculação iniciada” na biblioteca."
          type="date"
          defaultValue={props.defaults.startedOn}
          error={errors.startedOn}
        />
      </div>

      <TextField
        name="productLink"
        label="Produto (opcional)"
        hint="O link da ficha do produto no Radar ou o link do produto na Shopee."
        defaultValue={props.defaults.productLink}
        error={errors.productLink}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adText">Texto do anúncio (opcional)</Label>
        <textarea
          id="adText"
          name="adText"
          rows={4}
          defaultValue={props.defaults.adText}
          aria-invalid={errors.adText != null}
          className="rounded-lg border border-input bg-transparent px-3 py-2 text-base sm:text-sm"
        />
        <FieldError id="adText-erro" message={errors.adText} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          Onde o anúncio aparece
        </legend>
        <div className="flex flex-wrap gap-2">
          {AD_PLATFORMS.map((platform) => (
            <label
              key={platform}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm"
            >
              <input
                type="checkbox"
                name="platforms"
                value={platform}
                defaultChecked={props.defaults.platforms.includes(platform)}
                className="size-4 accent-primary"
              />
              {AD_PLATFORM_LABEL[platform]}
            </label>
          ))}
        </div>
        <FieldError id="platforms-erro" message={errors.platforms} />
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" className="h-11 px-5" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar anúncio"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 px-5"
          onClick={() => router.push(ADMIN_ADS_PATH)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
