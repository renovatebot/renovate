import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import type { HostRule } from '../../../types/index.ts';
import { matchRegexOrGlobList } from '../../../util/string-match.ts';

/**
 * Enforce the `allowedHeaders` allowlist before the host rules are applied.
 *
 * Loudly remove anything that's not permitted, logging a WARN.
 *
 * @param [allowedHeaders] the `allowedHeaders` as defined in `GlobalConfig`. Must be passed explicitly i.e. a `repositories[]` entry has an `allowedHeaders` override
 *
 * `headers` are merged key by key across matching host rules (see `find()` in `host-rules.ts`), so an admin's headers for a host survive even when a repo or preset rule also sets `headers` for the same host. Where both set the same header name, the more specific rule - or, when equally specific, the later-registered one - wins, which is the same precedence model {@link filterAllowedEnv} uses for `env`.
 */
export function filterAllowedHeaders(
  rules: HostRule[],
  allowedHeaders: string[] | undefined = GlobalConfig.get('allowedHeaders'),
): HostRule[] {
  const denied: string[] = [];

  const result = rules.map((rule) => {
    if (!rule.headers) {
      return rule;
    }

    const allowed: Record<string, string> = {};
    const ruleDenied: string[] = [];
    for (const [name, value] of Object.entries(rule.headers)) {
      if (matchRegexOrGlobList(name, allowedHeaders)) {
        allowed[name] = value;
      } else {
        ruleDenied.push(name);
      }
    }

    if (!ruleDenied.length) {
      return rule;
    }
    denied.push(...ruleDenied);
    return { ...rule, headers: allowed };
  });

  if (denied.length) {
    logger.warn(
      { denied },
      "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
    );
  }
  return result;
}
