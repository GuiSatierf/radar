import { KeyRound, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LegalLinks } from "@/features/legal/components/legal-links";
import { PLANS } from "@/features/plans/plans";
import { CommissionProfileSwitcher } from "@/features/settings/commission-profile-switcher";
import { requireCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Configurações" };

const CHANGE_PASSWORD_PATH = "/configuracoes/senha";

function SettingsRow(props: {
  title: string;
  description: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{props.title}</p>
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </div>
      {props.children}
    </div>
  );
}

export default async function SettingsPage(): Promise<ReactElement> {
  const user = await requireCurrentUser();

  return (
    <section className="max-w-2xl divide-y divide-border">
      <SettingsRow
        title="Aparência"
        description="O claro é o padrão. A escolha fica salva neste aparelho."
      >
        <ThemeSwitcher />
      </SettingsRow>

      <SettingsRow
        title="Sua comissão da Shopee"
        description="A Shopee paga 3%, 4% ou 8% conforme o seu perfil de afiliada. Na dúvida, deixe 3%. O Radar calcula o seu ganho com esse número."
      >
        <CommissionProfileSwitcher value={user.commissionProfile} />
      </SettingsRow>

      <SettingsRow title="Conta" description={user.email}>
        <p className="text-sm text-muted-foreground">{user.name}</p>
      </SettingsRow>

      <SettingsRow
        title="Senha"
        description="Troque a senha quando quiser. A conta sai dos outros aparelhos."
      >
        <Link
          href={CHANGE_PASSWORD_PATH}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-input px-4 text-sm font-medium hover:bg-muted"
        >
          <KeyRound className="size-4" aria-hidden />
          Trocar senha
        </Link>
      </SettingsRow>

      <SettingsRow
        title="Plano"
        description={`${PLANS[user.plan].description} Para mudar de plano, fale com o suporte.`}
      >
        <span className="text-sm font-medium">{PLANS[user.plan].label}</span>
      </SettingsRow>

      <SettingsRow
        title="Termos e privacidade"
        description="As regras do serviço e o que fazemos com os seus dados."
      >
        <LegalLinks />
      </SettingsRow>

      <SettingsRow title="Sair" description="Encerra o acesso neste aparelho.">
        <SignOutButton className="inline-flex h-10 items-center gap-2 rounded-lg border border-input px-4 text-sm font-medium hover:bg-muted">
          <LogOut className="size-4" aria-hidden />
          Sair da conta
        </SignOutButton>
      </SettingsRow>
    </section>
  );
}
