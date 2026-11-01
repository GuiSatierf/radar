import { z } from "zod";

// Shared with createAuth in src/lib/auth.ts, so the server enforces the same limits.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
const NAME_MAX_LENGTH = 80;

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Digite um e-mail válido." }));

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, { error: "Digite sua senha." }),
});

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Digite seu nome." })
    .max(NAME_MAX_LENGTH, { error: "Use no máximo 80 letras." }),
  email: emailField,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, {
      error: `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    })
    .max(PASSWORD_MAX_LENGTH, {
      error: `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
    }),
});

export const forgotPasswordSchema = z.object({ email: emailField });

const newPasswordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    error: `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    error: `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  });

export const newPasswordSchema = z
  .object({
    password: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    error: "As duas senhas precisam ser iguais.",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Digite a senha atual." }),
    password: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    error: "As duas senhas precisam ser iguais.",
  })
  .refine((data) => data.password !== data.currentPassword, {
    path: ["password"],
    error: "A senha nova precisa ser diferente da atual.",
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** First message per field, ready to show under each input. */
export function toFieldErrors<T>(error: z.ZodError<T>): FieldErrors<T> {
  const entries = error.issues
    .filter((issue) => issue.path.length > 0)
    .map((issue) => [String(issue.path[0]), issue.message] as const);

  return Object.fromEntries(entries.toReversed()) as FieldErrors<T>;
}

/** Raised by the server-side sign-up validation in src/lib/auth.ts. */
export const INVALID_SIGN_UP_CODE = "INVALID_SIGN_UP";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  [INVALID_SIGN_UP_CODE]: "Confira os dados do cadastro e tente de novo.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail. Tente entrar.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Já existe uma conta com este e-mail. Tente entrar.",
  PASSWORD_TOO_SHORT: `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  PASSWORD_TOO_LONG: `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  INVALID_EMAIL: "Digite um e-mail válido.",
  BANNED_USER: "Esta conta está bloqueada. Fale com o suporte.",
  INVALID_TOKEN: "Este link não vale mais. Peça um novo.",
  INVALID_PASSWORD: "A senha atual está errada.",
};

const GENERIC_AUTH_ERROR = "Não deu certo agora. Tente de novo em instantes.";
const TOO_MANY_ATTEMPTS =
  "Muitas tentativas. Espere um minuto e tente de novo.";
const HTTP_TOO_MANY_REQUESTS = 429;

/** Translates a Better Auth error into a short message in Portuguese. */
export function getAuthErrorMessage(error: {
  code?: string;
  status?: number;
}): string {
  if (error.status === HTTP_TOO_MANY_REQUESTS) return TOO_MANY_ATTEMPTS;

  if (error.code == null) return GENERIC_AUTH_ERROR;

  return AUTH_ERROR_MESSAGES[error.code] ?? GENERIC_AUTH_ERROR;
}
