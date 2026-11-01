import type { ReactElement } from "react";
import { AppHeader } from "@/components/app-shell/app-header";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { Sidebar } from "@/components/app-shell/sidebar";
import { listLockedTools } from "@/features/plans/access";
import { getAppName } from "@/lib/env";
import { getInitials } from "@/lib/initials";
import { requireCurrentUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: LayoutProps<"/">): Promise<ReactElement> {
  const user = await requireCurrentUser();
  // Only the icons: each tool page checks the plan again on the server.
  const lockedTools = listLockedTools(user);
  const appName = getAppName();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] gap-4 p-3 md:p-4">
      <Sidebar
        appName={appName}
        appInitials={getInitials(appName)}
        lockedTools={lockedTools}
        isAdmin={user.isAdmin}
      />

      <main className="flex min-w-0 flex-1 flex-col gap-6 rounded-2xl bg-card p-4 pb-28 sm:p-6 lg:pb-6">
        <AppHeader userName={user.name} isAdmin={user.isAdmin} />
        {children}
      </main>

      <BottomNav lockedTools={lockedTools} />
    </div>
  );
}
