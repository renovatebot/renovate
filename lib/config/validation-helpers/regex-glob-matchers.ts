import is from '@sindresorhus/is';
import type { ValidationMessage } from '../types';
import type { CheckMatcherArgs } from './types';

/**
 * Only if type condition or context condition violated then errors array will be mutated to store metadata
 */
export function check({
  val,
  currentPath,
}: CheckMatcherArgs): ValidationMessage[] {
  let errMessage: string | undefined;

  if (is.array(val, is.string)) {
    if ((val.includes('*') || val.includes('**')) && val.length > 1) {
      errMessage = `${currentPath}: Your input contains * or ** along with other patterns. Please remove them, as * or ** matches all patterns.`;
    }
  } else {
    errMessage = `${currentPath}: should be an array of strings. You have included ${typeof val}.`;
  }

  return errMessage
    ? [
        {
          topic: 'Configuration Error',
          message: errMessage,
        },
      ]
    : [];
}
