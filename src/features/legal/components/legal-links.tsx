import Link from "next/link";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import { PRIVACY_PATH, TERMS_PATH } from "../legal-info";

/** The two documents side by side, for the bottom of the sign-in screens and the settings. */
export function LegalLinks(props: { className?: string }): ReactElement {
  return (
    <nav
      aria-label="Termos e privacidade"
      className={cn(
        "flex flex-wrap gap-x-4 text-sm text-muted-foreground",
        props.className,
      )}
    >
      <Link href={TERMS_PATH} className="inline-flex min-h-11 items-center">
        Termos de uso
      </Link>
      <Link href={PRIVACY_PATH} className="inline-flex min-h-11 items-center">
        Política de privacidade
      </Link>
    </nav>
  );
}
