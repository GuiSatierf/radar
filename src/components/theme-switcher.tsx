"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { ReactElement } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsClient } from "@/lib/use-is-client";

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

export function ThemeSwitcher(): ReactElement {
  const { theme, setTheme } = useTheme();
  // The saved theme only exists in the browser, so the server renders no selection.
  const isClient = useIsClient();
  const selected = isClient && theme != null ? [theme] : [];

  return (
    <ToggleGroup
      aria-label="Aparência"
      variant="outline"
      spacing={0}
      value={selected}
      onValueChange={(values) => {
        const next = values[0];

        if (next == null) return;

        setTheme(next);
      }}
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;

        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="h-10 gap-1.5 px-3"
          >
            <Icon className="size-4" aria-hidden />
            {option.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
