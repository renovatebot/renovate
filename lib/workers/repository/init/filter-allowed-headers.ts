import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import type { HostRule } from '../../../types/index.ts';
import { matchRegexOrGlobList } from '../../../util/string-match.ts';

/**
 * Enforce the `allowedHeaders` allowlist before the host rules are applied.
 *
 * Loudly remove anything that's not permitted, logging a WARN.
 *
 * Unlike {@link filterAllowedEnv}, it is not currently possible for a self-hosted admin's headers to take precedence, as we lean on the "merging" logic (which currently, incorrectly, takes only repo-level `headers` if they're set for a given host).
 */
export function filterAllowedHeaders(rules: HostRule[]): HostRule[] {
  const allowedHeaders = GlobalConfig.get('allowedHeaders');
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
