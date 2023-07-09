import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { satisfiesDateRange } from '../pretty-time';
import { Matcher } from './base';

export class CurrentAgeMatcher extends Matcher {
  override matches(
    { releaseTimestamp }: PackageRuleInputConfig,
    { matchCurrentAge }: PackageRule
  ): boolean | null {
    if (is.undefined(matchCurrentAge) || is.nullOrUndefined(releaseTimestamp)) {
      return null;
    }

    return satisfiesDateRange(releaseTimestamp, matchCurrentAge);
  }
}
