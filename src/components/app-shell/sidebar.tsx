"use client";

import { Lock, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import {
  ADMIN_NAVIGATION,
  isActivePath,
  type NavigationItem,
  SETTINGS_NAVIGATION,
  TOOL_NAVIGATION,
} from "@/config/navigation";
import type { Tool } from "@/features/plans/plans";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

const ITEM_CLASS =
  "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring";

function SidebarLink(props: {
  item: NavigationItem;
  isActive: boolean;
  isLocked?: boolean;
}): ReactElement {
  const Icon = props.item.icon;

  return (
    <Link
      href={props.item.href}
      aria-label={
        props.isLocked ? `${props.item.label} (sem acesso)` : undefined
      }
      aria-current={props.isActive ? "page" : undefined}
      className={cn(
        ITEM_CLASS,
        props.isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-5 shrink-0",
          props.isActive && "text-sidebar-primary",
        )}
        aria-hidden
      />
      {props.item.label}
      {props.isLocked && <Lock className="ml-auto size-4" aria-hidden />}
    </Link>
  );
}

/** Desktop navigation: a light column with each area's icon and name. */
export function Sidebar(props: {
  appName: string;
  appInitials: string;
  lockedTools: readonly Tool[];
  isAdmin: boolean;
}): ReactElement {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Ferramentas"
      className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-56 shrink-0 flex-col gap-1 rounded-2xl border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground lg:flex"
    >
      <Link
        href="/radar"
        className="mb-3 flex items-center gap-3 rounded-xl px-1 py-1 font-semibold text-foreground"
      >
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sm text-sidebar-primary-foreground"
        >
          {props.appInitials}
        </span>
        {props.appName}
      </Link>

      {TOOL_NAVIGATION.map((item) => (
        <SidebarLink
          key={item.href}
          item={item}
          isActive={isActivePath(pathname, item.href)}
          isLocked={props.lockedTools.includes(item.tool)}
        />
      ))}

      <div className="flex-1" />
      <div className="mx-2 my-2 h-px bg-sidebar-border" />

      {props.isAdmin && (
        <SidebarLink
          item={ADMIN_NAVIGATION}
          isActive={isActivePath(pathname, ADMIN_NAVIGATION.href)}
        />
      )}

      <SidebarLink
        item={SETTINGS_NAVIGATION}
        isActive={isActivePath(pathname, SETTINGS_NAVIGATION.href)}
      />

      <SignOutButton className={ITEM_CLASS}>
        <LogOut className="size-5 shrink-0" aria-hidden />
        Sair
      </SignOutButton>
    </nav>
  );
}
