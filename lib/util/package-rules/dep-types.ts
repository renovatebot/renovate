import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { anyMatchRegexOrGlobList, matchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class DepTypesMatcher extends Matcher {
  override matches(
    { depTypes, depType }: PackageRuleInputConfig,
    { matchDepTypes }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchDepTypes)) {
      return null;
    }

    if (depType) {
      return matchRegexOrGlobList(depType, matchDepTypes);
    }

    if (depTypes) {
      return anyMatchRegexOrGlobList(depTypes, matchDepTypes);
    }

    return false;
  }
}
