import is from '@sindresorhus/is';
import { getRegexPredicate, isRegexMatch } from '../../util/string-match';
import type { ValidationMessage } from '../types';
import type { CheckMatcherArgs } from './types';

/**
 * Only if type condition or context condition violated then errors array will be mutated to store metadata
 */
export function check({
  val: matchers,
  currentPath,
}: CheckMatcherArgs): ValidationMessage[] {
  const res: ValidationMessage[] = [];

  if (is.array(matchers, is.string)) {
    if (
      (matchers.includes('*') || matchers.includes('**')) &&
      matchers.length > 1
    ) {
      res.push({
        topic: 'Configuration Error',
        message: `${currentPath}: Your input contains * or ** along with other patterns. Please remove them, as * or ** matches all patterns.`,
      });
    }
    for (const matcher of matchers) {
      // Validate regex pattern
      if (isRegexMatch(matcher)) {
        if (!getRegexPredicate(matcher)) {
          res.push({
            topic: 'Configuration Error',
            message: `Failed to parse regex pattern "${matcher}"`,
          });
        }
      }
    }
  } else {
    res.push({
      topic: 'Configuration Error',
      message: `${currentPath}: should be an array of strings. You have included ${typeof matchers}.`,
    });
  }

  return res;
}
