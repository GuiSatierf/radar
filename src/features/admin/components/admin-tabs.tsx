import Link from "next/link";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "contas", href: "/admin", label: "Contas" },
  { key: "anuncios", href: "/admin/anuncios", label: "Anúncios" },
  { key: "hotmart", href: "/admin/hotmart", label: "Hotmart" },
  { key: "acessos", href: "/admin/acessos", label: "Acessos" },
] as const;

export type AdminTab = (typeof TABS)[number]["key"];

/** The admin areas, as links: each one is its own page. */
export function AdminTabs(props: { active: AdminTab }): ReactElement {
  return (
    <nav aria-label="Áreas do admin" className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={props.active === tab.key ? "page" : undefined}
          className={cn(
            "inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium transition-colors",
            props.active === tab.key
              ? "border-transparent bg-accent text-accent-foreground"
              : "border-input hover:bg-muted",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
