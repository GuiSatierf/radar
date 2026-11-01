import {
  Clapperboard,
  type LucideIcon,
  Megaphone,
  Radar,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Tool } from "@/features/plans/plans";

export interface NavigationItem {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
}

export interface ToolNavigationItem extends NavigationItem {
  readonly tool: Tool;
}

/** The tools, in the order a beginner uses them: choose, learn from others, create. */
export const TOOL_NAVIGATION: readonly ToolNavigationItem[] = [
  {
    tool: "radar",
    href: "/radar",
    label: "Radar",
    description: "Produtos com pouca concorrência para você divulgar.",
    icon: Radar,
  },
  {
    tool: "rankings",
    href: "/rankings",
    label: "Rankings",
    description:
      "O que mais vende, o que mais paga e o que está crescendo na Shopee.",
    icon: TrendingUp,
  },
  {
    tool: "anuncios",
    href: "/anuncios",
    label: "Anúncios",
    description: "Anúncios que estão no ar há tempo, para você se inspirar.",
    icon: Megaphone,
  },
  {
    tool: "creators",
    href: "/creators",
    label: "Creators",
    description: "Os posts que mais deram certo de quem já vende muito.",
    icon: Users,
  },
  {
    tool: "studio",
    href: "/studio",
    label: "Studio",
    description: "Crie o vídeo do produto com inteligência artificial.",
    icon: Clapperboard,
  },
];

export const SETTINGS_NAVIGATION: NavigationItem = {
  href: "/configuracoes",
  label: "Configurações",
  description: "Aparência e conta.",
  icon: Settings,
};

/** Shown only to admins; the server checks the role again on every admin page and action. */
export const ADMIN_NAVIGATION: NavigationItem = {
  href: "/admin",
  label: "Admin",
  description: "Contas, planos, anúncios e a coleta de produtos.",
  icon: ShieldCheck,
};

export const HOME_PATH = "/radar";

export function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href) return true;

  return pathname.startsWith(`${href}/`);
}

export function findNavigationItem(pathname: string): NavigationItem | null {
  const items = [...TOOL_NAVIGATION, SETTINGS_NAVIGATION, ADMIN_NAVIGATION];

  return items.find((item) => isActivePath(pathname, item.href)) ?? null;
}
