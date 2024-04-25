import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { getRegexPredicate } from '../string-match';
import { Matcher } from './base';

export class CurrentValueMatcher extends Matcher {
  override matches(
    { currentValue }: PackageRuleInputConfig,
    { matchCurrentValue }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchCurrentValue)) {
      return null;
    }
    const matchCurrentValuePred = getRegexPredicate(matchCurrentValue);

    if (!matchCurrentValuePred) {
      logger.debug(
        { matchCurrentValue },
        'matchCurrentValue should be a regex, starting and ending with `/`',
      );
      return false;
    }

    if (!currentValue) {
      return false;
    }

    return matchCurrentValuePred(currentValue);
  }
}
