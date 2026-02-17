import { isUndefined } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { matchRegexOrGlobList } from '../string-match.ts';
import { Matcher } from './base.ts';

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
