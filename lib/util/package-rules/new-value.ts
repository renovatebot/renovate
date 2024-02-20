import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { getRegexPredicate } from '../string-match';
import { Matcher } from './base';

export class NewValueMatcher extends Matcher {
  override matches(
    { newValue }: PackageRuleInputConfig,
    { matchNewValue }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchNewValue)) {
      return null;
    }
    const matchNewValuePred = getRegexPredicate(matchNewValue);

    if (!matchNewValuePred) {
      logger.debug(
        { matchNewValue },
        'matchNewValue should be a regex, starting and ending with `/`',
      );
      return false;
    }

    if (!newValue) {
      return false;
    }

    return matchNewValuePred(newValue);
  }
}
