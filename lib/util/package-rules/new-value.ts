import { isUndefined } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { getRegexOrGlobPredicate } from '../string-match.ts';
import { Matcher } from './base.ts';

export class NewValueMatcher extends Matcher {
  override matches(
    { newValue }: PackageRuleInputConfig,
    { matchNewValue }: PackageRule,
  ): boolean | null {
    if (isUndefined(matchNewValue)) {
      return null;
    }
    const matchNewValuePred = getRegexOrGlobPredicate(matchNewValue);

    if (!newValue) {
      return false;
    }

    return matchNewValuePred(newValue);
  }
}
