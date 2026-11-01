import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getServerEnv } from "@/lib/env";
import { selectEmailSender } from "@/sources/email/select-email-sender";

export const metadata: Metadata = { title: "Esqueci minha senha" };

/** Without a way to send e-mail, promising a link would leave the person waiting for nothing. */
function SupportNotice(props: {
  supportUrl: string | undefined;
}): ReactElement {
  return (
    <div className="grid gap-3 rounded-2xl bg-card p-6">
      <h1 className="text-xl font-semibold">Esqueci minha senha</h1>
      <p className="text-sm text-muted-foreground">
        Por enquanto, a troca de senha é feita pelo suporte. Fale com a gente
        que ajudamos você a entrar de novo.
      </p>
      {props.supportUrl != null && (
        <a
          href={props.supportUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground"
        >
          Falar com o suporte
        </a>
      )}
      <Link href="/entrar" className="text-sm font-medium text-primary">
        Voltar para entrar
      </Link>
    </div>
  );
}

export default function ForgotPasswordPage(): ReactElement {
  const env = getServerEnv();

  if (selectEmailSender(env) == null) {
    return <SupportNotice supportUrl={env.SUPPORT_URL} />;
  }

  return <ForgotPasswordForm />;
}
