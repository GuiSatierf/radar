"use client";

import { type ReactElement, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  COMMISSION_PROFILES,
  type CommissionProfile,
} from "@/features/radar/domain/commission";
import { updateCommissionProfile } from "./actions";

export function CommissionProfileSwitcher(props: {
  value: CommissionProfile;
}): ReactElement {
  const [isPending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(props.value);

  function choose(next: CommissionProfile): void {
    startTransition(async () => {
      setShown(next);
      const result = await updateCommissionProfile(next);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(`Comissão da Shopee: ${next}%`);
    });
  }

  return (
    <ToggleGroup
      aria-label="Sua comissão da Shopee"
      aria-busy={isPending}
      variant="outline"
      spacing={0}
      value={[String(shown)]}
      onValueChange={(values) => {
        const next = COMMISSION_PROFILES.find(
          (profile) => String(profile) === values[0],
        );

        if (next == null) return;

        choose(next);
      }}
    >
      {COMMISSION_PROFILES.map((profile) => (
        <ToggleGroupItem
          key={profile}
          value={String(profile)}
          className="h-10 px-4"
        >
          {profile}%
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
