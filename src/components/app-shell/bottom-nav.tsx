"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { isActivePath, TOOL_NAVIGATION } from "@/config/navigation";
import type { Tool } from "@/features/plans/plans";
import { cn } from "@/lib/utils";

/** A small padlock on the icon of a tool outside the plan. */
function LockMark(): ReactElement {
  return (
    <span className="absolute -top-1 -right-2.5 flex size-4 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
      <Lock className="size-2.5" aria-hidden />
    </span>
  );
}

/** Phone and tablet navigation: the same tools as the desktop sidebar, fixed at the bottom. */
export function BottomNav(props: {
  lockedTools: readonly Tool[];
}): ReactElement {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Ferramentas"
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-sidebar-border bg-sidebar px-1 py-1.5 text-sidebar-foreground shadow-lg shadow-foreground/5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      {TOOL_NAVIGATION.map((item) => {
        const Icon = item.icon;
        const isActive = isActivePath(pathname, item.href);
        const isLocked = props.lockedTools.includes(item.tool);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            aria-label={
              isLocked ? `${item.label} (fora do seu plano)` : undefined
            }
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <span className="relative">
              <Icon
                className={cn("size-5", isActive && "text-sidebar-primary")}
                aria-hidden
              />
              {isLocked && <LockMark />}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
