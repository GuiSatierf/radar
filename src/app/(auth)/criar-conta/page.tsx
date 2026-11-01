import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage(): ReactElement {
  return <SignUpForm />;
}
