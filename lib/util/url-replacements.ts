import { isPlainObject } from '@sindresorhus/is';
import type { UrlReplacement } from '../config/types.ts';
import { logger } from '../logger/index.ts';
import { coerceArray } from './array.ts';
import { isHttpUrlPrefix } from './url.ts';

/**
 * The host types of the requests which `urlReplacements` rewrites.
 */
export const urlReplacementHostTypes: readonly string[] = ['maven'];

/**
 * Returns whether `rule` is an object whose prefixes are both valid url prefixes.
 */
export function isValidUrlReplacement(rule: unknown): rule is UrlReplacement {
  return (
    isPlainObject(rule) &&
    isHttpUrlPrefix(rule.matchUrlPrefix) &&
    isHttpUrlPrefix(rule.replaceUrlPrefix)
  );
}

/**
 * Returns whether one of the url prefixes `a` and `b` starts with the other.
 */
function prefixesOverlap(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a);
}

/**
 * Returns whether the `replaceUrlPrefix` of `rule` and the `matchUrlPrefix` of another rule of `rules` overlap.
 */
export function isChainedUrlReplacement(
  rule: UrlReplacement,
  rules: readonly UrlReplacement[],
): boolean {
  return rules.some(
    (other) =>
      other !== rule &&
      prefixesOverlap(rule.replaceUrlPrefix, other.matchUrlPrefix),
  );
}

/**
 * Returns whether the `matchUrlPrefix` of `rule` starts with the `matchUrlPrefix` of one of `earlierRules`.
 */
export function isShadowedUrlReplacement(
  rule: UrlReplacement,
  earlierRules: readonly UrlReplacement[],
): boolean {
  return earlierRules.some((earlier) =>
    rule.matchUrlPrefix.startsWith(earlier.matchUrlPrefix),
  );
}

/**
 * Returns whether `rule` is valid, and logs a warning once when it is not.
 */
function isUsableUrlReplacement(rule: unknown): rule is UrlReplacement {
  if (isValidUrlReplacement(rule)) {
    return true;
  }
  logger.once.warn({ rule }, 'urlReplacements: ignoring an invalid rule');
  return false;
}

/**
 * Returns the valid rules of `rules` whose `replaceUrlPrefix` no other rule rewrites, and whose `matchUrlPrefix` no earlier rule matches, and logs a warning once for each other rule.
 */
export function getUrlReplacements(
  rules: UrlReplacement[] | undefined,
): UrlReplacement[] {
  const validRules = coerceArray(rules).filter(isUsableUrlReplacement);
  const unchainedRules = validRules.filter((rule) => {
    if (!isChainedUrlReplacement(rule, validRules)) {
      return true;
    }
    logger.once.warn(
      { rule },
      'urlReplacements: ignoring a rule whose replaceUrlPrefix another rule rewrites',
    );
    return false;
  });
  return unchainedRules.filter((rule, index) => {
    if (!isShadowedUrlReplacement(rule, unchainedRules.slice(0, index))) {
      return true;
    }
    logger.once.warn(
      { rule },
      'urlReplacements: ignoring a rule whose matchUrlPrefix an earlier rule matches',
    );
    return false;
  });
}
