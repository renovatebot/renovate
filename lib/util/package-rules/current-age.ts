import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { satisfiesDateRange } from '../pretty-time';
import { Matcher } from './base';

export class CurrentAgeMatcher extends Matcher {
  override matches(
    { currentVersionReleaseTimeStamp }: PackageRuleInputConfig,
    { matchCurrentAge }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchCurrentAge)) {
      return null;
    }

    if (is.undefined(currentVersionReleaseTimeStamp)) {
      return false;
    }

    return satisfiesDateRange(currentVersionReleaseTimeStamp, matchCurrentAge);
  }
}
