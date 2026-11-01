import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

/** Placeholder for a tool that arrives in a later stage; says plainly what will be here. */
export function ComingSoon(props: {
  icon: LucideIcon;
  title: string;
  description: string;
}): ReactElement {
  const Icon = props.icon;

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-input bg-muted/40 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="size-6" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{props.title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {props.description}
      </p>
    </section>
  );
}
