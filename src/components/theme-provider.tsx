"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps, ReactElement } from "react";

export function ThemeProvider(
  props: ComponentProps<typeof NextThemesProvider>,
): ReactElement {
  return <NextThemesProvider {...props} />;
}
