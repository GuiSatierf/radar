"use client";

import Link from "next/link";
import { type ReactElement, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema } from "@/lib/auth-forms";
import { FormField } from "./form-field";
import { useAuthForm } from "./use-auth-form";

export const NEW_PASSWORD_PATH = "/nova-senha";

function SentNotice(): ReactElement {
  return (
    <div role="status" className="grid gap-3 rounded-2xl bg-card p-6">
      <h1 className="text-xl font-semibold">Confira seu e-mail</h1>
      <p className="text-sm text-muted-foreground">
        Se existir uma conta com esse e-mail, mandamos um link para criar uma
        senha nova. Ele vale por 1 hora. Olhe também a caixa de spam.
      </p>
      <Link href="/entrar" className="text-sm font-medium text-primary">
        Voltar para entrar
      </Link>
    </div>
  );
}

/** Always answers the same way, so the form never reveals who has an account. */
export function ForgotPasswordForm(): ReactElement {
  const [isSent, setIsSent] = useState(false);
  const form = useAuthForm({
    schema: forgotPasswordSchema,
    submit: (data) =>
      authClient.requestPasswordReset({
        email: data.email,
        redirectTo: NEW_PASSWORD_PATH,
      }),
    onSuccess: () => setIsSent(true),
  });

  if (isSent) return <SentNotice />;

  return (
    <form
      method="post"
      onSubmit={form.handleSubmit}
      noValidate
      className="grid gap-4 rounded-2xl bg-card p-6"
    >
      <h1 className="text-xl font-semibold">Esqueci minha senha</h1>
      <p className="text-sm text-muted-foreground">
        Digite o e-mail da sua conta. Vamos mandar um link para você criar uma
        senha nova.
      </p>

      <FormField
        id="email"
        name="email"
        type="email"
        label="E-mail"
        autoComplete="email"
        placeholder="voce@email.com"
        error={form.fieldErrors.email}
      />

      {form.formError != null && (
        <p role="alert" className="text-sm text-destructive">
          {form.formError}
        </p>
      )}

      <Button
        type="submit"
        className="h-11 text-base"
        disabled={!form.canSubmit}
      >
        {form.isPending ? "Enviando…" : "Mandar o link"}
      </Button>

      <Link
        href="/entrar"
        className="text-center text-sm font-medium text-primary"
      >
        Voltar para entrar
      </Link>
    </form>
  );
}
