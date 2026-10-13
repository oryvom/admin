import { hash, verify } from "@node-rs/argon2";
import { generateOpaqueToken } from "@/lib/security/tokens";

const ARGON2ID = 2;
const MEMORY_COST = 19_456;
const TIME_COST = 2;
const PARALLELISM = 1;

/**
 * Hash of random data with the production Argon2id parameters.
 * It is not a credential. Unknown accounts are verified against it so the
 * response time stays close to a real password check.
 */
const UNKNOWN_ACCOUNT_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$OSOaSafb4vEG/vQQq12WiQ$/XyjXrLP/hdqXWvvR+tf9G6zaT69JquhhuZmJP3wGvA";

export async function hashRandomSecret(): Promise<string> {
  return hashPassword(generateOpaqueToken());
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: MEMORY_COST,
    timeCost: TIME_COST,
    parallelism: PARALLELISM,
    algorithm: ARGON2ID,
  });
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function verifyPasswordOrDummy(password: string, passwordHash: string | null): Promise<boolean> {
  return verifyPassword(password, passwordHash ?? UNKNOWN_ACCOUNT_HASH);
}
