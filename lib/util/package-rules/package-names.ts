import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class PackageNameMatcher extends Matcher {
  override matches(
    { depName }: PackageRuleInputConfig,
    { matchPackageNames }: PackageRule
  ): boolean | null {
    if (is.undefined(matchPackageNames)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }
    return matchPackageNames.includes(depName);
  }

  override excludes(
    { depName }: PackageRuleInputConfig,
    { excludePackageNames }: PackageRule
  ): boolean | null {
    if (is.undefined(excludePackageNames)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }
    return excludePackageNames.includes(depName);
  }
}
