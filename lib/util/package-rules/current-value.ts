import { isUndefined } from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { getRegexOrGlobPredicate } from '../string-match';
import { Matcher } from './base';

export class CurrentValueMatcher extends Matcher {
  override matches(
    { currentValue }: PackageRuleInputConfig,
    { matchCurrentValue }: PackageRule,
  ): boolean | null {
    if (isUndefined(matchCurrentValue)) {
      return null;
    }
    const matchCurrentValuePred = getRegexOrGlobPredicate(matchCurrentValue);

    if (!currentValue) {
      return false;
    }

    return matchCurrentValuePred(currentValue);
  }
}
