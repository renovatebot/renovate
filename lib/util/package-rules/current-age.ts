import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';
import { satisfiesRange } from '../pretty-time';

export class CurrentAgeMatcher extends Matcher {
  override matches(
    { releaseTimestamp }: PackageRuleInputConfig,
    { matchCurrentAge }: PackageRule
  ): boolean | null {
    if (is.undefined(matchCurrentAge) || is.nullOrUndefined(releaseTimestamp)) {
      return null;
    }

    return satisfiesRange(releaseTimestamp, matchCurrentAge);
  }
}
