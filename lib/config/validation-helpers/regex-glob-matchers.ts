import { isArray, isString } from '@sindresorhus/is';
import { regEx } from '../../util/regex.ts';
import { getRegexPredicate, isRegexMatch } from '../../util/string-match.ts';
import type { ValidationMessage } from '../types.ts';
import type { CheckMatcherArgs } from './types.ts';

// Tokens meaningful in a RegExp but not in a glob, signalling a pattern that is
// likely an unwrapped regex (i.e. one missing the surrounding `/.../`):
// a `^` anchor at the start, a `$` anchor at the end, or a `\d`/`\w`/`\s`/`\b`
// character-class escape.
const regexOnlyTokens = regEx(/^\^|\$$|\\[dwsbDWSB]/);

// Returns a plain boolean (not a type guard) so the caller's `matcher` keeps its
// `string` type — isRegexMatch's `is string` predicate would otherwise narrow it.
function looksLikeUnwrappedRegex(matcher: string): boolean {
  return !isRegexMatch(matcher) && regexOnlyTokens.test(matcher);
}

/**
 * Returns validation errors (hard failures) and warnings (heuristics) for a
 * list of regex-or-glob matchers.
 */
export function check({ val: matchers, currentPath }: CheckMatcherArgs): {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
} {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  if (isArray(matchers, isString)) {
    if (
      (matchers.includes('*') || matchers.includes('**')) &&
      matchers.length > 1
    ) {
      errors.push({
        topic: 'Configuration Error',
        message: `${currentPath}: Your input contains * or ** along with other patterns. Please remove them, as * or ** matches all patterns.`,
      });
    }
    for (const matcher of matchers) {
      // The matcher is not wrapped in `/.../`, so it is treated as a glob, but it
      // contains regex-only tokens and so was probably meant to be a regex.
      if (looksLikeUnwrappedRegex(matcher)) {
        warnings.push({
          topic: 'Configuration Warning',
          message: `${currentPath}: the pattern \`${matcher}\` looks like a regex but is not wrapped in \`/.../\`, so it is treated as a glob. Wrap it in slashes if you intended a regex.`,
        });
        continue;
      }
      // Validate regex pattern
      // No need to validate if the string is a glob
      // minimatch allows any string as glob
      if (isRegexMatch(matcher) && !getRegexPredicate(matcher)) {
        errors.push({
          topic: 'Configuration Error',
          message: `Failed to parse regex pattern for ${currentPath}: ${matcher}`,
        });
      }
    }
  } else {
    errors.push({
      topic: 'Configuration Error',
      message: `${currentPath}: should be an array of strings. You have included ${typeof matchers}.`,
    });
  }

  return { errors, warnings };
}
