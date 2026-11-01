"use client";

import { Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ADMIN_NAVIGATION, findNavigationItem } from "@/config/navigation";
import { getInitials } from "@/lib/initials";

export function AppHeader(props: {
  userName: string;
  isAdmin: boolean;
}): ReactElement {
  const pathname = usePathname();
  const current = findNavigationItem(pathname);
  const title = current == null ? "Início" : current.label;

  return (
    <header className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {current != null && (
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {current.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {props.isAdmin && (
          <Link
            href={ADMIN_NAVIGATION.href}
            aria-label={ADMIN_NAVIGATION.label}
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted lg:hidden"
          >
            <ShieldCheck className="size-5" aria-hidden />
          </Link>
        )}
        <Link
          href="/configuracoes"
          aria-label="Configurações"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted lg:hidden"
        >
          <Settings className="size-5" aria-hidden />
        </Link>
        <Avatar className="size-10">
          <AvatarFallback className="bg-accent text-sm font-medium text-accent-foreground">
            {getInitials(props.userName)}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
