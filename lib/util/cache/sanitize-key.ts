// A cache key is not a URL, but it can contain URLs, e.g. `getReleases:https://user:pass@example.com/maven:pkg` or a
// comma-joined list of registry URLs. So the regexes below find each `scheme://` inside the key and replace only the
// matched userinfo or query, also in keys which a URL parser rejects.

import { toSha256 } from '../hash.ts';
import {
  getDetachedCredentialsHash,
  hasDetachedCredentials,
} from '../host-rules.ts';
import { regEx } from '../regex.ts';
import { urlUserinfoRegex } from '../url.ts';

// a URL up to its first `?`, followed by the query string
const urlQueryRegex = regEx(
  /(?<prefix>[a-z][a-z\d+.-]*:\/\/[^\s?#]*)\?(?<query>[^\s#]+)/gi,
);

// the `scheme://` of a URL
const urlSchemeRegex = regEx(/[a-z][a-z\d+.-]*:\/\//gi);

const hashPrefix = 'sha256-';
const hashRegex = regEx(/^sha256-[\da-f]{16}$/);

// the hashed userinfo of a URL in a key which is already sanitized
const hashedUserinfoRegex = regEx(/^sha256-[\da-f]{16}@/);

type Groups = Record<string, string>;

/**
 * Returns the named groups, which a `replace()` callback receives as its last argument.
 */
function groupsOf(args: unknown[]): Groups {
  return args.at(-1) as Groups;
}

/**
 * Returns `sha256-` and the first 16 hex characters of the SHA-256 of `value`, or `value` itself when it already is such a hash.
 */
export function hashOnce(value: string): string {
  return hashRegex.test(value)
    ? value
    : `${hashPrefix}${toSha256(value).slice(0, 16)}`;
}

/**
 * Inserts a hash of the credentials which `detachUrlCredentials()` registered for a URL inside `key` as the userinfo of that URL.
 */
function addDetachedCredentialsHashes(key: string): string {
  if (!hasDetachedCredentials()) {
    return key;
  }
  return key.replace(urlSchemeRegex, (scheme: string, offset: number) => {
    const url = key.slice(offset);
    // a hashed userinfo already holds the hash of the detached credentials
    if (hashedUserinfoRegex.test(url.slice(scheme.length))) {
      return scheme;
    }
    const credentialsHash = getDetachedCredentialsHash(url);
    if (!credentialsHash) {
      return scheme;
    }
    return `${scheme}${hashOnce(credentialsHash)}@`;
  });
}

/**
 * Replaces the `user:password@` userinfo and the `?query` of any URL inside a cache key with a hash of each.
 * A key which is already sanitized is returned unchanged.
 *
 * @returns the key with every userinfo and every query string replaced by `sha256-` and the first 16 hex characters of its SHA-256
 */
export function hashUserinfoAndQuery(key: string): string {
  return key
    .replace(urlUserinfoRegex, (...args: unknown[]) => {
      const { scheme, userinfo } = groupsOf(args);
      return `${scheme}://${hashOnce(userinfo)}@`;
    })
    .replace(urlQueryRegex, (...args: unknown[]) => {
      const { prefix, query } = groupsOf(args);
      return `${prefix}?${hashOnce(query)}`;
    });
}

/**
 * Replaces the `user:password@` userinfo and the `?query` of any URL inside a cache key with a hash of each, and gives a URL with credentials registered by `detachUrlCredentials()` a hash of those as its userinfo.
 * A key which is already sanitized is returned unchanged.
 *
 * @returns the key with every userinfo and every query string replaced by `sha256-` and the first 16 hex characters of its SHA-256
 */
export function sanitizeKey(key: string): string {
  return hashUserinfoAndQuery(addDetachedCredentialsHashes(key));
}
