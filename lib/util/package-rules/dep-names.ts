import { isUndefined } from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { matchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class DepNameMatcher extends Matcher {
  override matches(
    { depName }: PackageRuleInputConfig,
    { matchDepNames }: PackageRule,
  ): boolean | null {
    if (isUndefined(matchDepNames)) {
      return null;
    }
    if (isUndefined(depName)) {
      return false;
    }
    return matchRegexOrGlobList(depName, matchDepNames);
  }
}
