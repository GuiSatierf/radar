import { Users } from "lucide-react";
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ComingSoon } from "@/components/app-shell/coming-soon";
import { LockedTool } from "@/features/plans/components/locked-tool";
import { checkToolAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Creators" };

export default async function CreatorsPage(): Promise<ReactElement> {
  const { user, isAllowed } = await checkToolAccess("creators");

  if (!isAllowed) return <LockedTool tool="creators" plan={user.plan} />;

  return (
    <ComingSoon
      icon={Users}
      title="Os creators vão aparecer aqui"
      description="Perfis que vendem muito e os vídeos e carrosséis que deram mais certo."
    />
  );
}
