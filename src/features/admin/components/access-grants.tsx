"use client";

import { Trash2 } from "lucide-react";
import {
  type FormEvent,
  type ReactElement,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/lib/use-is-client";
import {
  grantAccessByEmail,
  revokeAccessByEmail,
} from "../access-grant-actions";
import { describeGrantedCount } from "../email-list";

export function GrantAccessForm(): ReactElement {
  const [isPending, startTransition] = useTransition();
  const [leftOut, setLeftOut] = useState<string[]>([]);
  // Before JavaScript runs, a click would only reload the page with the e-mails in the address.
  const isReady = useIsClient();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      const result = await grantAccessByEmail({
        emails: data.get("emails"),
      });

      if (result.ok === false) {
        setLeftOut([]);
        toast.error(result.message);
        return;
      }

      // Only what was left out stays in the box, ready to fix and send again.
      const box = form.elements.namedItem("emails");

      if (box instanceof HTMLTextAreaElement)
        box.value = result.invalid.join("\n");

      setLeftOut(result.invalid);
      toast.success(`${describeGrantedCount(result.granted)}.`);
    });
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        name="emails"
        rows={5}
        aria-label="E-mails para liberar"
        placeholder={
          "Um e-mail por linha, ex.:\nana@gmail.com\nbia@hotmail.com"
        }
        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          className="h-11"
          disabled={isReady === false || isPending}
        >
          {isPending ? "Liberando…" : "Liberar"}
        </Button>
      </div>
      {leftOut.length > 0 && (
        <p
          role="status"
          className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          Estes não parecem e-mail e ficaram de fora: {leftOut.join(", ")}
        </p>
      )}
    </form>
  );
}

export function RevokeAccessButton(props: { email: string }): ReactElement {
  const [isPending, startTransition] = useTransition();

  function revoke(): void {
    const confirmed = window.confirm(
      `Tirar o acesso de ${props.email}? A conta perde o acesso liberado aqui.`,
    );

    if (confirmed === false) return;

    startTransition(async () => {
      const result = await revokeAccessByEmail({ email: props.email });

      if (result.ok === false) {
        toast.error(result.message);
        return;
      }

      toast.success(`Acesso de ${props.email} tirado`);
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11"
      aria-label={`Tirar o acesso de ${props.email}`}
      disabled={isPending}
      onClick={revoke}
    >
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}
