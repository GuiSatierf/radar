import { hash, verify } from "@node-rs/argon2";

// argon2id with the OWASP minimum (19 MiB, 2 iterations, 1 lane); the library defaults to argon2id.
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(input: {
  hash: string;
  password: string;
}): Promise<boolean> {
  return verify(input.hash, input.password);
}
