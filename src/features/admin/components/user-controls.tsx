"use client";

import { Ban, LockOpen } from "lucide-react";
import { type ReactElement, useTransition } from "react";
import { toast } from "sonner";
import { PLAN_IDS, PLANS, type PlanId } from "@/features/plans/plans";
import { changeUserPlan, setUserBlocked } from "../actions";

export function PlanSelect(props: {
  userId: string;
  userName: string;
  plan: PlanId;
}): ReactElement {
  const [isPending, startTransition] = useTransition();

  function choose(value: string): void {
    const plan = PLAN_IDS.find((id) => id === value);

    if (plan == null) return;

    startTransition(async () => {
      const result = await changeUserPlan({ userId: props.userId, plan });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(`${props.userName}: plano ${PLANS[plan].label}`);
    });
  }

  return (
    <select
      aria-label={`Plano de ${props.userName}`}
      aria-busy={isPending}
      disabled={isPending}
      value={props.plan}
      onChange={(event) => choose(event.target.value)}
      className="h-11 rounded-lg border border-input bg-transparent px-2 text-sm font-medium text-foreground disabled:opacity-60"
    >
      {PLAN_IDS.map((id) => (
        <option key={id} value={id}>
          {PLANS[id].label}
        </option>
      ))}
    </select>
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
