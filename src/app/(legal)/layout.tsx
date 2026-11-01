import Link from "next/link";
import type { ReactElement } from "react";
import { getAppName } from "@/lib/env";

/** Open to everyone, signed in or not: the documents must be readable before creating an account. */
export default function LegalLayout({
  children,
}: LayoutProps<"/">): ReactElement {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center px-4">
          <Link
            href="/"
            className="inline-flex min-h-14 items-center text-lg font-semibold tracking-tight"
          >
            {getAppName()}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}
