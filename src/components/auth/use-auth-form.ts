"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import type { z } from "zod";
import { HOME_PATH } from "@/config/navigation";
import {
  type FieldErrors,
  getAuthErrorMessage,
  toFieldErrors,
} from "@/lib/auth-forms";
import { useIsClient } from "@/lib/use-is-client";

type AuthResult = { error: { code?: string; status?: number } | null };

/**
 * Shared by the auth forms: validate on the device, call Better Auth, show the error in
 * Portuguese, then go to the Radar (or do what the form asks).
 */
export function useAuthForm<Schema extends z.ZodType>(input: {
  schema: Schema;
  submit: (data: z.output<Schema>) => Promise<AuthResult>;
  /** What happens after it worked; by default, go to the Radar. */
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Until the page runs JavaScript the button stays off, so the browser can never submit the
  // form on its own (which would send the password in the address bar).
  const isReady = useIsClient();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<z.output<Schema>>>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const parsed = input.schema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const { error } = await input.submit(parsed.data);

      if (error != null) {
        setFormError(getAuthErrorMessage(error));
        return;
      }

      if (input.onSuccess != null) {
        input.onSuccess();
        return;
      }

      router.replace(HOME_PATH);
      router.refresh();
    });
  }

  return {
    handleSubmit,
    fieldErrors,
    formError,
    isPending,
    canSubmit: isReady && !isPending,
  };
}
