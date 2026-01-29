import { isUndefined } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { getRegexOrGlobPredicate } from '../string-match.ts';
import { Matcher } from './base.ts';

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
