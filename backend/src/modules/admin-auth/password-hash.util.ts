import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/**
 * scrypt (Node's built-in `crypto` module) — an OWASP-recommended
 * memory-hard adaptive KDF, chosen here over an external bcrypt/argon2
 * package specifically because this stage was implemented while the npm
 * registry was unreachable from this environment (verified with a direct
 * `curl` to registry.npmjs.org, not a pnpm-specific issue). `node:crypto`
 * is already a proven dependency in this codebase — `createHash`/
 * `randomBytes` are used the same way in `auth.service.ts` and
 * `storage.service.ts` — so this adds zero new external dependencies
 * while still satisfying docs/admin-architecture-decision-record.md §12.6
 * ("a modern adaptive hash, never anything reversible").
 *
 * Encoded as `salt:derivedKeyHex`, both hex — self-contained, no separate
 * column needed for the salt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

/** Constant-time comparison via `timingSafeEqual` — never a plain `===` on secrets. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;

  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const storedBuffer = Buffer.from(hashHex, 'hex');
  if (storedBuffer.length !== derivedKey.length) return false;

  return timingSafeEqual(derivedKey, storedBuffer);
}
