import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { getRegexOrGlobPredicate } from '../string-match';
import { Matcher } from './base';

export class NewValueMatcher extends Matcher {
  override matches(
    { newValue }: PackageRuleInputConfig,
    { matchNewValue }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchNewValue)) {
      return null;
    }
    const matchNewValuePred = getRegexOrGlobPredicate(matchNewValue);

    if (!newValue) {
      return false;
    }

    return matchNewValuePred(newValue);
  }
}
