import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage(
  props: PageProps<"/entrar">,
): Promise<ReactElement> {
  const { senha } = await props.searchParams;

  return <SignInForm passwordChanged={senha === "nova"} />;
}
