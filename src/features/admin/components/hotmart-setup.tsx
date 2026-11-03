"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { type FormEvent, type ReactElement, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HotmartIdKind } from "@/features/billing/hotmart/plan-mapping";
import { PAID_PLAN_IDS, PLANS } from "@/features/plans/plans";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";
import {
  addHotmartPlan,
  removeHotmartPlan,
  saveHotmartHottok,
  setHotmartUnlocking,
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

export function UnlockSwitch(props: {
  isOn: boolean;
  /** Already written for the screen, e.g. "Ligado em 03/11/2026, 10:20". */
  stateLabel: string;
}): ReactElement {
  const [isPending, startTransition] = useTransition();

  function toggle(): void {
    startTransition(async () => {
      const result = await setHotmartUnlocking({
        unlocks: props.isOn === false,
      });

      if (result.ok === false) {
        toast.error(result.message);
        return;
      }

      toast.success(
        props.isOn
          ? "Liberação automática desligada"
          : "Liberação automática ligada",
      );
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.isOn}
      aria-label="Liberar os planos sozinho"
      disabled={isPending}
      onClick={toggle}
      className="flex min-h-11 items-center gap-3 self-start rounded-lg text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      <span
        aria-hidden
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          props.isOn ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-background shadow-sm transition-[left]",
            props.isOn ? "left-[1.125rem]" : "left-0.5",
          )}
        />
      </span>
      <span>{props.stateLabel}</span>
    </button>
  );
}
