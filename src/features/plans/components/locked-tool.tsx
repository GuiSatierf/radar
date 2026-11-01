import { Lock, MessageCircle } from "lucide-react";
import type { ReactElement } from "react";
import { TOOL_NAVIGATION } from "@/config/navigation";
import { getServerEnv } from "@/lib/env";
import { cheapestPlanWith, PLANS, type PlanId, type Tool } from "../plans";

function describeLock(
  tool: Tool,
  plan: PlanId,
): { title: string; text: string } {
  if (plan === "none") {
    return {
      title: "Sua conta ainda não tem um plano",
      text: "Assim que o seu plano for liberado, as ferramentas abrem aqui.",
    };
  }

  const label =
    TOOL_NAVIGATION.find((item) => item.tool === tool)?.label ?? tool;
  const cheapest = cheapestPlanWith(tool);
  const where =
    cheapest == null ? "" : ` Faz parte do plano ${cheapest.label}.`;

  return {
    title: `${label} não está no seu plano`,
    text: `Seu plano hoje é o ${PLANS[plan].label}.${where}`,
  };
}

/** What a tool page shows instead of its content when the plan does not open it. */
export function LockedTool(props: { tool: Tool; plan: PlanId }): ReactElement {
  const { title, text } = describeLock(props.tool, props.plan);
  const supportUrl = getServerEnv().SUPPORT_URL;

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-input bg-muted/40 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Lock className="size-6" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {text} Para liberar, fale com o suporte.
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
