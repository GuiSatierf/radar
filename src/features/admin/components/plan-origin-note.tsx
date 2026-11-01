import type { ReactElement } from "react";
import type { PlanOrigin } from "../plan-origin";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function describe(origin: PlanOrigin): string | null {
  if (origin.kind === "none") return null;

  if (origin.kind === "manual") return "Plano mudado pelo admin";

  if (origin.endsAt == null) return "Plano pela Hotmart";

  return `Plano pela Hotmart · cancelado, acesso até ${dateFormatter.format(origin.endsAt)}`;
}

/** One line under the account: where its plan came from. */
export function PlanOriginNote(props: {
  origin: PlanOrigin;
}): ReactElement | null {
  const text = describe(props.origin);

  if (text == null) return null;

  return <p className="text-xs text-muted-foreground">{text}</p>;
}
