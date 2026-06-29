import { isPlainObject } from '@sindresorhus/is';
import { Json } from '../schema-utils/index.ts';

/**
 * Detects whether a token string is likely a JWT (JSON Web Token).
 *
 * JWTs consist of three base64url-encoded segments separated by dots.
 * The first segment (header) must decode to valid JSON containing
 * at least a `typ` or `alg` field.
 */
export function isProbablyJwt(token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const result = Json.safeParse(
    Buffer.from(parts[0], 'base64url').toString('utf8'),
  );
  return (
    result.success &&
    isPlainObject(result.data) &&
    ('typ' in result.data || 'alg' in result.data)
  );
}
