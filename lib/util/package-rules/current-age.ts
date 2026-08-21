import { isString } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { satisfiesDateRange } from '../pretty-time.ts';
import { Matcher } from './base.ts';

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
