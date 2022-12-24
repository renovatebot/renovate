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
    return !!(
      (depName && matchPackageNames.includes(depName)) ||
      (packageName && matchPackageNames.includes(packageName))
    );
  }

  override excludes(
    { depName, packageName }: PackageRuleInputConfig,
    { excludePackageNames }: PackageRule
  ): boolean | null {
    if (is.undefined(excludePackageNames)) {
      return null;
    }
    return !!(
      (depName && excludePackageNames.includes(depName)) ||
      (packageName && excludePackageNames.includes(packageName))
    );
  }
}
