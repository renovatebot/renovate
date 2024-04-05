import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class DepNameMatcher extends Matcher {
  override matches(
    { depName }: PackageRuleInputConfig,
    { matchDepNames }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchDepNames)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }
    return matchDepNames.includes(depName);
  }

  override excludes(
    { depName }: PackageRuleInputConfig,
    { excludeDepNames }: PackageRule,
  ): boolean | null {
    if (is.undefined(excludeDepNames)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }
    return excludeDepNames.includes(depName);
  }
}
