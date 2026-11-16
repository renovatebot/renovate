import { isArray, isString, isUndefined } from '@sindresorhus/is';
import type { UrlReplacement } from '../config/types.ts';
import { logger } from '../logger/index.ts';
import { coerceArray } from './array.ts';
import { isHttpUrlPrefix } from './url.ts';

/**
 * Returns whether `matchHostTypes` of `rule` is unset or a list of strings.
 */
function hasValidMatchHostTypes({ matchHostTypes }: UrlReplacement): boolean {
  return isUndefined(matchHostTypes) || isArray(matchHostTypes, isString);
}

/**
 * Returns whether both prefixes of `rule` are valid url prefixes, and its `matchHostTypes` is unset or a list of strings.
 */
export function isValidUrlReplacement(rule: UrlReplacement): boolean {
  return (
    isHttpUrlPrefix(rule.matchUrlPrefix) &&
    isHttpUrlPrefix(rule.replaceUrlPrefix) &&
    hasValidMatchHostTypes(rule)
  );
}

/**
 * Returns whether `rule` is valid, and logs a warning once when it isn't.
 */
function isUsableUrlReplacement(rule: UrlReplacement): boolean {
  if (isValidUrlReplacement(rule)) {
    return true;
  }
  logger.once.warn({ rule }, 'urlReplacements: ignoring an invalid rule');
  return false;
}

/**
 * Returns the valid rules of `rules`.
 */
export function getUrlReplacements(
  rules: UrlReplacement[] | undefined,
): UrlReplacement[] {
  return coerceArray(rules).filter(isUsableUrlReplacement);
}
