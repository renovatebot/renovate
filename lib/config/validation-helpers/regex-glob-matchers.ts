import is from '@sindresorhus/is';
import { getRegexPredicate, isRegexMatch } from '../../util/string-match';
import type { ValidationMessage } from '../types';
import type { CheckMatcherArgs } from './types';

/**
 * Only if type condition or context condition violated then errors array will be mutated to store metadata
 */
export function check({
  val,
  currentPath,
}: CheckMatcherArgs): ValidationMessage[] {
  const res: ValidationMessage[] = [];

  if (is.array(val, is.string)) {
    if ((val.includes('*') || val.includes('**')) && val.length > 1) {
      res.push({
        topic: 'Configuration Error',
        message: `${currentPath}: Your input contains * or ** along with other patterns. Please remove them, as * or ** matches all patterns.`,
      });
    }
    for (const pattern of val) {
      // Validate regex pattern
      if (isRegexMatch(pattern)) {
        const autodiscoveryPred = getRegexPredicate(pattern);
        if (!autodiscoveryPred) {
          res.push({
            topic: 'Configuration Error',
            message: `Failed to parse regex pattern "${pattern}"`,
          });
        }
      }
    }
  } else {
    res.push({
      topic: 'Configuration Error',
      message: `${currentPath}: should be an array of strings. You have included ${typeof val}.`,
    });
  }

  return res;
}
