import { Lock, MessageCircle } from "lucide-react";
import type { ReactElement } from "react";
import { getServerEnv } from "@/lib/env";

/**
 * What a tool page shows instead of its content while the account has no access. Access opens
 * every tool at once, so the notice is the same on every page.
 */
export function LockedTool(): ReactElement {
  const supportUrl = getServerEnv().SUPPORT_URL;

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-input bg-muted/40 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Lock className="size-6" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">Sua conta ainda não tem acesso</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Assim que o seu acesso for liberado, as ferramentas abrem aqui. Para
        liberar, fale com o suporte.
      </p>
      {supportUrl != null && (
        <a
          href={supportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <MessageCircle className="size-4" aria-hidden />
          Falar com o suporte
        </a>
      )}
    </section>
  );
}
