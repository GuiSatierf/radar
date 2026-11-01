"use client";

import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { newPasswordSchema } from "@/lib/auth-forms";
import { FormField } from "./form-field";
import { useAuthForm } from "./use-auth-form";

export const PASSWORD_CHANGED_PATH = "/entrar?senha=nova";

export function NewPasswordForm(props: { token: string }): ReactElement {
  const router = useRouter();
  const form = useAuthForm({
    schema: newPasswordSchema,
    submit: (data) =>
      authClient.resetPassword({
        newPassword: data.password,
        token: props.token,
      }),
    onSuccess: () => router.replace(PASSWORD_CHANGED_PATH),
  });

  return (
    <form
      method="post"
      onSubmit={form.handleSubmit}
      noValidate
      className="grid gap-4 rounded-2xl bg-card p-6"
    >
      <h1 className="text-xl font-semibold">Crie uma senha nova</h1>

      <FormField
        id="password"
        name="password"
        type="password"
        label="Senha nova"
        autoComplete="new-password"
        error={form.fieldErrors.password}
      />
      <FormField
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        label="Repita a senha nova"
        autoComplete="new-password"
        error={form.fieldErrors.confirmPassword}
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
        {form.isPending ? "Salvando…" : "Salvar senha nova"}
      </Button>
    </form>
  );
}
