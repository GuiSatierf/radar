import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { z } from "zod";
import { NewPasswordForm } from "@/components/auth/new-password-form";

export const metadata: Metadata = { title: "Senha nova" };

// Better Auth sends ?token=… when the link is valid and ?error=INVALID_TOKEN when it is not.
const tokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,200}$/)
  .nullable()
  .catch(null);

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;

  return value ?? null;
}

function ExpiredLink(): ReactElement {
  return (
    <div className="grid gap-3 rounded-2xl bg-card p-6">
      <h1 className="text-xl font-semibold">Este link não vale mais</h1>
      <p className="text-sm text-muted-foreground">
        O link para criar uma senha nova vale por 1 hora e só funciona uma vez.
        Peça outro e use o mais recente.
      </p>
      <Link
        href="/esqueci-a-senha"
        className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground"
      >
        Pedir um link novo
      </Link>
    </div>
  );
}

export default async function NewPasswordPage(
  props: PageProps<"/nova-senha">,
): Promise<ReactElement> {
  const params = await props.searchParams;
  const token = tokenSchema.parse(firstValue(params.token));

  if (token == null || params.error != null) return <ExpiredLink />;

  return <NewPasswordForm token={token} />;
}
