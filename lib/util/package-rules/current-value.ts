import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { configRegexPredicate } from '../regex';
import { Matcher } from './base';

export class CurrentValueMatcher extends Matcher {
  override matches(
    { currentValue }: PackageRuleInputConfig,
    { matchCurrentValue }: PackageRule
  ): boolean | null {
    if (is.undefined(matchCurrentValue)) {
      return null;
    }
    const matchCurrentValueStr = matchCurrentValue.toString();
    const matchCurrentValuePred = configRegexPredicate(matchCurrentValueStr);

    if (!matchCurrentValuePred) {
      logger.warn(
        { matchCurrentValueStr },
        'matchCurrentValue should be a regex, starting and ending with `/`'
      );
      return null;
    }

    if (!currentValue) {
      return false;
    }

    return matchCurrentValuePred(currentValue);
  }
}
