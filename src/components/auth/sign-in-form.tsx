"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { signInSchema } from "@/lib/auth-forms";
import { FormField } from "./form-field";
import { useAuthForm } from "./use-auth-form";

export function SignInForm(props: {
  /** Back from "Crie uma senha nova": say it worked. */
  passwordChanged?: boolean;
}): ReactElement {
  const form = useAuthForm({
    schema: signInSchema,
    submit: (data) => authClient.signIn.email(data),
  });

  return (
    <form
      method="post"
      onSubmit={form.handleSubmit}
      noValidate
      className="grid gap-4 rounded-2xl bg-card p-6"
    >
      <h1 className="text-xl font-semibold">Entrar</h1>

      {props.passwordChanged === true && (
        <p
          role="status"
          className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground"
        >
          Senha nova salva. Entre com ela.
        </p>
      )}

      <FormField
        id="email"
        name="email"
        type="email"
        label="E-mail"
        autoComplete="email"
        placeholder="voce@email.com"
        error={form.fieldErrors.email}
      />
      <FormField
        id="password"
        name="password"
        type="password"
        label="Senha"
        autoComplete="current-password"
        error={form.fieldErrors.password}
      />
      <Link
        href="/esqueci-a-senha"
        className="-mt-2 justify-self-start py-2 text-sm font-medium text-primary"
      >
        Esqueci minha senha
      </Link>

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
        {form.isPending ? "Entrando…" : "Entrar"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/criar-conta" className="font-medium text-primary">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
