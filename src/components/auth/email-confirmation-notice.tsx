"use client";

import { CircleAlert, CircleCheck, Mail } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type ReactElement, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HOME_PATH } from "@/config/navigation";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-forms";

const CONFIRMED_PARAM = "email";
const CONFIRMED_VALUE = "confirmado";

/** Where the link in the e-mail lands; Better Auth adds `error=...` when the link failed. */
export const EMAIL_CONFIRMED_PATH = `${HOME_PATH}?${CONFIRMED_PARAM}=${CONFIRMED_VALUE}`;

/** Shown on every app page until the account's e-mail is confirmed. */
export function EmailConfirmationNotice(props: {
  email: string;
}): ReactElement {
  const [isPending, startTransition] = useTransition();

  function handleResend(): void {
    startTransition(async () => {
      const { error } = await authClient.sendVerificationEmail({
        email: props.email,
        callbackURL: EMAIL_CONFIRMED_PATH,
      });

      if (error != null) {
        toast.error(getAuthErrorMessage(error));
        return;
      }

      toast.success(`Mandamos outro link para ${props.email}.`);
    });
  }

  return (
    <section
      aria-label="Confirme seu e-mail"
      className="flex items-start gap-3 rounded-xl border border-input px-4 py-3"
    >
      <Mail className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="grid min-w-0 gap-2">
        <div>
          <h2 className="text-sm font-semibold">Confirme seu e-mail</h2>
          <p className="text-sm text-muted-foreground">
            Enviamos um link para{" "}
            <span className="break-all">{props.email}</span>. Se você comprou ou
            ganhou um plano, ele é liberado assim que você confirmar.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-fit"
          disabled={isPending}
          onClick={handleResend}
        >
          Reenviar e-mail
        </Button>
      </div>
    </section>
  );
}

/**
 * The answer after the link in the e-mail: confirmed, or a link that no longer works. Each one
 * shows only when the account agrees: an old link opened after confirming is not a problem.
 */
export function EmailConfirmationResult(props: {
  isEmailConfirmed: boolean;
}): ReactElement | null {
  const searchParams = useSearchParams();

  if (props.isEmailConfirmed === false) {
    if (searchParams.get("error") == null) return null;

    return (
      <p
        role="alert"
        className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <CircleAlert className="size-5 shrink-0" aria-hidden />
        Esse link venceu ou não vale mais. Peça outro no aviso acima.
      </p>
    );
  }

  if (searchParams.get(CONFIRMED_PARAM) !== CONFIRMED_VALUE) return null;

  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
    >
      <CircleCheck className="size-5 shrink-0" aria-hidden />
      E-mail confirmado. Se havia um plano esperando, ele já está liberado.
    </p>
  );
}
