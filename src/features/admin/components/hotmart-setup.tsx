"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { type FormEvent, type ReactElement, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HotmartIdKind } from "@/features/billing/hotmart/plan-mapping";
import { PAID_PLAN_IDS, PLANS } from "@/features/plans/plans";
import { useIsClient } from "@/lib/use-is-client";
import {
  addHotmartPlan,
  removeHotmartPlan,
  saveHotmartHottok,
} from "../hotmart-actions";
import { HOTMART_KIND_LABEL } from "../hotmart-labels";

const SELECT_CLASS =
  "h-11 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground";

export function WebhookAddress(props: { url: string }): ReactElement {
  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(props.url);
      toast.success("Endereço copiado");
    } catch {
      // Some browsers block the clipboard; the address is on screen to copy by hand.
      toast.error("Não deu para copiar. Selecione o endereço e copie.");
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-3 text-sm">
        {props.url}
      </code>
      <Button variant="outline" className="h-11 gap-1.5" onClick={handleCopy}>
        <Copy className="size-4" aria-hidden />
        Copiar
      </Button>
    </div>
  );
}

export function HottokForm(): ReactElement {
  const [isPending, startTransition] = useTransition();
  // Only after JavaScript runs, so the browser never sends the code in the page address.
  const isReady = useIsClient();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const hottok = new FormData(form).get("hottok");

    startTransition(async () => {
      const result = await saveHotmartHottok({ hottok });

      if (result.ok === false) {
        toast.error(result.message);
        return;
      }

      form.reset();
      toast.success("Código da Hotmart salvo");
    });
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <Input
        type="password"
        name="hottok"
        autoComplete="off"
        aria-label="Código secreto da Hotmart"
        placeholder="Cole o código (hottok)"
        className="h-11 flex-1 text-base"
      />
      <Button
        type="submit"
        variant="outline"
        className="h-11"
        disabled={isReady === false || isPending}
      >
        {isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}

export function AddPlanForm(): ReactElement {
  const [isPending, startTransition] = useTransition();
  // Before JavaScript runs, a click would only reload the page with the fields in the address.
  const isReady = useIsClient();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      const result = await addHotmartPlan({
        kind: data.get("kind"),
        hotmartId: data.get("hotmartId"),
        plan: data.get("plan"),
      });

      if (result.ok === false) {
        toast.error(result.message);
        return;
      }

      form.reset();
      toast.success("Produto salvo");
    });
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_1fr_auto_auto]"
    >
      <select
        name="kind"
        aria-label="Tipo do código"
        defaultValue="plano"
        className={SELECT_CLASS}
      >
        {Object.entries(HOTMART_KIND_LABEL).map(([kind, label]) => (
          <option key={kind} value={kind}>
            {label}
          </option>
        ))}
      </select>
      <Input
        name="hotmartId"
        inputMode="numeric"
        aria-label="Código na Hotmart"
        placeholder="Código, ex.: 460805"
        className="h-11 text-base"
      />
      <select
        name="plan"
        aria-label="Plano que ele libera"
        defaultValue="radar"
        className={SELECT_CLASS}
      >
        {PAID_PLAN_IDS.map((plan) => (
          <option key={plan} value={plan}>
            {PLANS[plan].label}
          </option>
        ))}
      </select>
      <Button
        type="submit"
        variant="outline"
        className="h-11 gap-1.5"
        disabled={isReady === false || isPending}
      >
        <Plus className="size-4" aria-hidden />
        Adicionar
      </Button>
    </form>
  );
}

export function RemovePlanButton(props: {
  kind: HotmartIdKind;
  hotmartId: string;
}): ReactElement {
  const [isPending, startTransition] = useTransition();
  const name = `${HOTMART_KIND_LABEL[props.kind]} ${props.hotmartId}`;

  function remove(): void {
    const confirmed = window.confirm(
      `Tirar ${name}? Compras dele param de liberar plano.`,
    );

    if (confirmed === false) return;

    startTransition(async () => {
      const result = await removeHotmartPlan({
        kind: props.kind,
        hotmartId: props.hotmartId,
      });

      if (result.ok === false) {
        toast.error(result.message);
        return;
      }

      toast.success(`${name} tirado`);
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11"
      aria-label={`Tirar ${name}`}
      disabled={isPending}
      onClick={remove}
    >
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}
