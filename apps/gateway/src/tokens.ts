import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 192-bit random token, URL-safe. */
export const newToken = (): string => randomBytes(24).toString('base64url');

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('base64url');

export function tokenMatches(token: string, expectedHash: string): boolean {
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(expectedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}
