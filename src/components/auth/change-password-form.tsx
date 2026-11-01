"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SETTINGS_NAVIGATION } from "@/config/navigation";
import { authClient } from "@/lib/auth-client";
import { changePasswordSchema, PASSWORD_MIN_LENGTH } from "@/lib/auth-forms";
import { FormField } from "./form-field";
import { useAuthForm } from "./use-auth-form";

const SETTINGS_PATH = SETTINGS_NAVIGATION.href;

export function ChangePasswordForm(): ReactElement {
  const router = useRouter();
  const form = useAuthForm({
    schema: changePasswordSchema,
    submit: (data) =>
      authClient.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.password,
        // Whoever knew the old password is logged out everywhere else.
        revokeOtherSessions: true,
      }),
    onSuccess: () => {
      toast.success("Senha trocada. Os outros aparelhos saíram da conta.");
      router.replace(SETTINGS_PATH);
      router.refresh();
    },
  });

  return (
    <form
      method="post"
      onSubmit={form.handleSubmit}
      noValidate
      className="grid gap-4 rounded-2xl bg-card p-6"
    >
      <h2 className="text-xl font-semibold">Trocar senha</h2>

      <FormField
        id="currentPassword"
        name="currentPassword"
        type="password"
        label="Senha atual"
        autoComplete="current-password"
        error={form.fieldErrors.currentPassword}
      />
      <FormField
        id="password"
        name="password"
        type="password"
        label={`Senha nova (mínimo ${PASSWORD_MIN_LENGTH} caracteres)`}
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

      <p className="text-sm text-muted-foreground">
        Depois de trocar, a conta sai de todos os outros aparelhos.
      </p>

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

      <Link
        href={SETTINGS_PATH}
        className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary"
      >
        Voltar para as configurações
      </Link>
    </form>
  );
}
