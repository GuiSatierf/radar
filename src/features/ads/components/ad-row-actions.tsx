"use client";

import { CalendarCheck, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { type ReactElement, useTransition } from "react";
import { toast } from "sonner";
import {
  type AdActionResult,
  markAdSeenToday,
  removeAd,
  setAdHidden,
} from "../actions";

const BUTTON_CLASS =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-input px-2 text-sm font-medium whitespace-nowrap hover:bg-muted disabled:opacity-60 sm:px-3";
const ICON_CLASS = "hidden size-4 sm:block";

/**
 * The admin's buttons for one ad. Manual ads: still running today, edit, take off the list.
 * Automatic ads: edit and hide (the collection already checks them, and would bring a deleted
 * one back).
 */
export function AdRowActions(props: {
  id: number;
  advertiserName: string;
  isManual: boolean;
  isHidden: boolean;
}): ReactElement {
  const [isPending, startTransition] = useTransition();
  const name = props.advertiserName;

  function run(action: () => Promise<AdActionResult>, success: string): void {
    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(success);
    });
  }

  function remove(): void {
    const question = `Tirar o anúncio de ${name} da lista? Ele some para todo mundo.`;

    if (!window.confirm(question)) return;

    run(() => removeAd(props.id), `Anúncio de ${name} tirado da lista.`);
  }

  function toggleHidden(): void {
    const hidden = !props.isHidden;

    run(
      () => setAdHidden({ id: props.id, hidden }),
      hidden
        ? `Anúncio de ${name} escondido.`
        : `Anúncio de ${name} visível de novo.`,
    );
  }

  const edit = (
    <Link
      href={`/admin/anuncios/${props.id}`}
      aria-label={`Editar o anúncio de ${name}`}
      className={BUTTON_CLASS}
    >
      <Pencil className={ICON_CLASS} aria-hidden />
      Editar
    </Link>
  );

  if (!props.isManual) {
    const HideIcon = props.isHidden ? Eye : EyeOff;
    const hideLabel = props.isHidden ? "Mostrar" : "Esconder";

    return (
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {edit}
        <button
          type="button"
          onClick={toggleHidden}
          disabled={isPending}
          aria-label={`${hideLabel} o anúncio de ${name}`}
          className={BUTTON_CLASS}
        >
          <HideIcon className={ICON_CLASS} aria-hidden />
          {hideLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:flex">
      <button
        type="button"
        onClick={() =>
          run(
            () => markAdSeenToday(props.id),
            `Anúncio de ${name} conferido hoje.`,
          )
        }
        disabled={isPending}
        aria-label={`Conferi hoje o anúncio de ${name}`}
        className={BUTTON_CLASS}
      >
        <CalendarCheck className={ICON_CLASS} aria-hidden />
        Conferi hoje
      </button>
      {edit}
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        aria-label={`Tirar o anúncio de ${name}`}
        className={BUTTON_CLASS}
      >
        <Trash2 className={ICON_CLASS} aria-hidden />
        Tirar
      </button>
    </div>
  );
}
