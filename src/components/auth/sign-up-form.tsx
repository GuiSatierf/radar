"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { PRIVACY_PATH, TERMS_PATH } from "@/features/legal/legal-info";
import { authClient } from "@/lib/auth-client";
import { PASSWORD_MIN_LENGTH, signUpSchema } from "@/lib/auth-forms";
import { EMAIL_CONFIRMED_PATH } from "./email-confirmation-notice";
import { FormField } from "./form-field";
import { useAuthForm } from "./use-auth-form";

export function SignUpForm(): ReactElement {
  const form = useAuthForm({
    schema: signUpSchema,
    submit: (data) =>
      authClient.signUp.email({ ...data, callbackURL: EMAIL_CONFIRMED_PATH }),
  });

  return (
    <form
      method="post"
      onSubmit={form.handleSubmit}
      noValidate
      className="grid gap-4 rounded-2xl bg-card p-6"
    >
      <h1 className="text-xl font-semibold">Criar conta</h1>

      <FormField
        id="name"
        name="name"
        label="Seu nome"
        autoComplete="name"
        placeholder="Maria Souza"
        error={form.fieldErrors.name}
      />
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
        label={`Senha (mínimo ${PASSWORD_MIN_LENGTH} caracteres)`}
        autoComplete="new-password"
        error={form.fieldErrors.password}
      />

      {form.formError != null && (
        <p role="alert" className="text-sm text-destructive">
          {form.formError}
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Ao criar a conta, você concorda com os{" "}
        <Link
          href={TERMS_PATH}
          target="_blank"
          className="font-medium text-primary"
        >
          Termos de uso
        </Link>{" "}
        e a{" "}
        <Link
          href={PRIVACY_PATH}
          target="_blank"
          className="font-medium text-primary"
        >
          Política de privacidade
        </Link>
        .
      </p>

      <Button
        type="submit"
        className="h-11 text-base"
        disabled={!form.canSubmit}
      >
        {form.isPending ? "Criando…" : "Criar conta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-primary">
          Entrar
        </Link>
      </p>
    </form>
  );
}
