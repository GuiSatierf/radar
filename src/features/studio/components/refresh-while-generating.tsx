"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_INTERVAL_IN_MS = 3_000;

/** While a video is being made, reloads the page data so "Gerando…" turns into "Pronto" by itself. */
export function RefreshWhileGenerating(): null {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_INTERVAL_IN_MS);

    return () => clearInterval(timer);
  }, [router]);

  return null;
}
