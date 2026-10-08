import { isArray, isNonEmptyArray, isString } from '@sindresorhus/is';
import jsonata from 'jsonata';
import * as memCache from './cache/memory/index.ts';
import { detectPlatform } from './common.ts';
import { toSha256 } from './hash.ts';
import {
  anyMatchRegexOrGlobList,
  matchRegexOrGlobList,
} from './string-match.ts';

export interface JsonataExpression {
  evaluate(data: unknown, bindings?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Matches `input` against Renovate string patterns (globs, regex, negation).
 * If `input` is an array, returns true if any string element matches.
 * Returns false for missing or non-string inputs and invalid patterns.
 */
export function matchRegexOrGlob(input: unknown, patterns: unknown): boolean {
  const patternList = isString(patterns) ? [patterns] : patterns;
  if (!isNonEmptyArray(patternList) || !patternList.every(isString)) {
    return false;
  }

  if (isString(input)) {
    return matchRegexOrGlobList(input, patternList);
  }

  if (isArray(input)) {
    return anyMatchRegexOrGlobList(input.filter(isString), patternList);
  }

  return false;
}

export function getExpression(input: string): JsonataExpression | Error {
  const cacheKey = `jsonata:${toSha256(input)}`;
  const cachedExpression = memCache.get<jsonata.Expression | Error>(cacheKey);
  // istanbul ignore if: cannot test
  if (cachedExpression) {
    return cachedExpression;
  }
  let result: jsonata.Expression | Error;
  try {
    const expression = jsonata(input);
    expression.registerFunction(
      'detectPlatform',
      (url: string) => detectPlatform(url),
      '<s-:s>',
    );
    // No signature: JSONata would reject arrays and `undefined` inputs otherwise
    expression.registerFunction('matchRegexOrGlob', matchRegexOrGlob);
    // Wrap the evaluate method to default bindings to {} for concurrent evaluation safety.
    // This prevents race conditions when the same cached expression is evaluated
    // concurrently with different data. See #40311 for background.
    const originalEvaluate = expression.evaluate.bind(expression);
    expression.evaluate = (
      data: unknown,
      bindings: Record<string, unknown> = {},
    ) => {
      return originalEvaluate(data, bindings);
    };
    result = expression;
  } catch (err) {
    // JSONata errors aren't detected as TypeOf Error
    result = new Error(err.message);
  }
  memCache.set(cacheKey, result);
  return result;
}
