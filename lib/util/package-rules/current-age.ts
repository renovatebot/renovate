import { isString } from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { satisfiesDateRange } from '../pretty-time';
import { Matcher } from './base';

export class CurrentAgeMatcher extends Matcher {
  override matches(
    { currentVersionTimestamp }: PackageRuleInputConfig,
    { matchCurrentAge }: PackageRule,
  ): boolean | null {
    if (!isString(matchCurrentAge)) {
      return null;
    }

    if (!isString(currentVersionTimestamp)) {
      return false;
    }

    return satisfiesDateRange(currentVersionTimestamp, matchCurrentAge);
  }
}
