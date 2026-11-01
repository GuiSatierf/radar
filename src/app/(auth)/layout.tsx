import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { HOME_PATH } from "@/config/navigation";
import { LegalLinks } from "@/features/legal/components/legal-links";
import { getAppName } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";

export default async function AuthLayout({
  children,
}: LayoutProps<"/">): Promise<ReactElement> {
  const user = await getCurrentUser();

  if (user != null) redirect(HOME_PATH);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-lg font-semibold tracking-tight">{getAppName()}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Produtos com pouca concorrência e vídeos prontos para divulgar.
          </p>
        </div>
        {children}
        <LegalLinks className="mt-4 justify-center" />
      </div>
    </main>
  );
}
