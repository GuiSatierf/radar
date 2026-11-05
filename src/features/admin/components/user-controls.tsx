"use client";

import { Ban, KeyRound, LockOpen, X } from "lucide-react";
import { type ReactElement, useTransition } from "react";
import { toast } from "sonner";
import { DEFAULT_PLAN, FULL_ACCESS, type PlanId } from "@/features/plans/plans";
import { changeUserPlan, setUserBlocked } from "../actions";

export function AccessButton(props: {
  userId: string;
  userName: string;
  plan: PlanId;
}): ReactElement {
  const [isPending, startTransition] = useTransition();
  const hasAccess = props.plan === FULL_ACCESS;
  const label = hasAccess ? "Tirar acesso" : "Liberar acesso";
  const Icon = hasAccess ? X : KeyRound;

  function toggle(): void {
    if (
      hasAccess &&
      window.confirm(
        `Tirar o acesso de ${props.userName}? As ferramentas fecham na hora.`,
      ) === false
    ) {
      return;
    }

    const plan = hasAccess ? DEFAULT_PLAN : FULL_ACCESS;

    startTransition(async () => {
      const result = await changeUserPlan({ userId: props.userId, plan });

      if (result.ok === false) {
        toast.error(result.message);
        return;
      }

      toast.success(
        hasAccess
          ? `Acesso de ${props.userName} tirado.`
          : `Acesso de ${props.userName} liberado.`,
      );
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={`${label} de ${props.userName}`}
      className="inline-flex h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

export function BlockButton(props: {
  userId: string;
  userName: string;
  isBlocked: boolean;
}): ReactElement {
  const [isPending, startTransition] = useTransition();
  const label = props.isBlocked ? "Desbloquear" : "Bloquear";
  const Icon = props.isBlocked ? LockOpen : Ban;

  function toggle(): void {
    const blocked = !props.isBlocked;

    if (
      blocked &&
      !window.confirm(
        `Bloquear ${props.userName}? A pessoa sai na hora e não consegue entrar.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await setUserBlocked({ userId: props.userId, blocked });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(
        blocked
          ? `Conta de ${props.userName} bloqueada.`
          : `Conta de ${props.userName} desbloqueada.`,
      );
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={`${label} ${props.userName}`}
      className="inline-flex h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}
