import { isPlainObject } from '@sindresorhus/is';
import { parseJsonc } from '../common.ts';

/**
 * Detects whether a token string is likely a JWT (JSON Web Token).
 *
 * JWTs consist of three base64url-encoded segments separated by dots.
 * The first segment (header) must decode to valid JSON containing
 * at least a `typ` or `alg` field.
 *
 * This is used to automatically distinguish Microsoft Entra ID (AAD)
 * Bearer tokens from Azure DevOps Personal Access Tokens (PATs).
 */
export function isProbablyJwt(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  try {
    const header = parseJsonc(
      Buffer.from(parts[0], 'base64url').toString('utf8'),
    );
    return isPlainObject(header) && ('typ' in header || 'alg' in header);
  } catch {
    return false;
  }
}
