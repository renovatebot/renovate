import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { satisfiesDateRange } from '../pretty-time';
import { Matcher } from './base';

export class ReleaseAgeMatcher extends Matcher {
  override matches(
    { releaseTimestamp }: PackageRuleInputConfig,
    { matchReleaseAge }: PackageRule,
  ): boolean | null {
    if (!is.string(matchReleaseAge)) {
      return null;
    }

    if (!is.string(releaseTimestamp)) {
      return false;
    }

    return satisfiesDateRange(releaseTimestamp, matchReleaseAge);
  }
}
