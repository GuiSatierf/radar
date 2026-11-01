"use client";

import { useRouter } from "next/navigation";
import { type ComponentProps, type ReactElement, useTransition } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

/** A plain button, so it can be the render target of a tooltip or styled like any link. */
export function SignOutButton(props: ComponentProps<"button">): ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut(): void {
    startTransition(async () => {
      const { error } = await authClient.signOut();

      if (error != null) {
        toast.error("Não deu para sair agora. Tente de novo.");
        return;
      }

      router.replace("/entrar");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      {...props}
      disabled={isPending}
      onClick={handleSignOut}
    />
  );
}
