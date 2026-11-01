"use client";

import { useSyncExternalStore } from "react";

const subscribeToNothing = (): (() => void) => () => {};

/** False on the server and before hydration, true once the page's JavaScript is running. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}
