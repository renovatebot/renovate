import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class PackageNameMatcher extends Matcher {
  override matches(
    { depName, packageName }: PackageRuleInputConfig,
    { matchPackageNames }: PackageRule
  ): boolean | null {
    if (is.undefined(matchPackageNames)) {
      return null;
    }
    return (
      (is.string(depName) && matchPackageNames.includes(depName)) ||
      (is.string(packageName) && matchPackageNames.includes(packageName))
    );
  }

  override excludes(
    { depName, packageName }: PackageRuleInputConfig,
    { excludePackageNames }: PackageRule
  ): boolean | null {
    if (is.undefined(excludePackageNames)) {
      return null;
    }
    return (
      (is.string(depName) && excludePackageNames.includes(depName)) ||
      (is.string(packageName) && excludePackageNames.includes(packageName))
    );
  }
}
