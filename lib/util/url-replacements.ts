import { isArray, isString, isUndefined } from '@sindresorhus/is';
import type { UrlReplacement } from '../config/types.ts';
import { logger } from '../logger/index.ts';
import { coerceArray } from './array.ts';
import { isHttpUrlPrefix } from './url.ts';

type UrlReplacementLike = Partial<Record<keyof UrlReplacement, unknown>>;

/**
 * Returns whether `matchHostTypes` of `rule` is unset or a list of strings.
 */
function hasValidMatchHostTypes({
  matchHostTypes,
}: UrlReplacementLike): boolean {
  return isUndefined(matchHostTypes) || isArray(matchHostTypes, isString);
}

/**
 * Returns whether both prefixes of `rule` are valid url prefixes, and its `matchHostTypes` is unset or a list of strings.
 */
export function isValidUrlReplacement(
  rule: UrlReplacementLike,
): rule is UrlReplacement {
  return (
    isHttpUrlPrefix(rule.matchUrlPrefix) &&
    isHttpUrlPrefix(rule.replaceUrlPrefix) &&
    hasValidMatchHostTypes(rule)
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
 * Returns whether `rule` is valid, and logs a warning once when it is not.
 */
function isUsableUrlReplacement(rule: UrlReplacement): boolean {
  if (isValidUrlReplacement(rule)) {
    return true;
  }
  logger.once.warn({ rule }, 'urlReplacements: ignoring an invalid rule');
  return false;
}

/**
 * Returns the valid rules of `rules` whose `replaceUrlPrefix` no other rule rewrites, and logs a warning once for each other rule.
 */
export function getUrlReplacements(
  rules: UrlReplacement[] | undefined,
): UrlReplacement[] {
  const validRules = coerceArray(rules).filter(isUsableUrlReplacement);
  return validRules.filter((rule) => {
    if (!isChainedUrlReplacement(rule, validRules)) {
      return true;
    }
    logger.once.warn(
      { rule },
      'urlReplacements: ignoring a rule whose replaceUrlPrefix another rule rewrites',
    );
    return false;
  });
}
