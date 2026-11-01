import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { requireCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Trocar senha" };

export default async function ChangePasswordPage(): Promise<ReactElement> {
  await requireCurrentUser();

  return (
    <div className="max-w-sm">
      <ChangePasswordForm />
    </div>
  );
}
