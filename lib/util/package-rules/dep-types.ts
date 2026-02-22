import { isUndefined } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import {
  anyMatchRegexOrGlobList,
  matchRegexOrGlobList,
} from '../string-match.ts';
import { Matcher } from './base.ts';

export class DepTypesMatcher extends Matcher {
  override matches(
    { depTypes, depType }: PackageRuleInputConfig,
    { matchDepTypes }: PackageRule,
  ): boolean | null {
    if (isUndefined(matchDepTypes)) {
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
