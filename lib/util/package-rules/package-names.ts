import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class PackageNameMatcher extends Matcher {
  override matches(
    { packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { matchPackageNames } = packageRule;
    if (is.undefined(matchPackageNames)) {
      return null;
    }
    if (!packageName) {
      return false;
    }
    return matchPackageNames.includes(packageName);
  }

  override excludes(
    { packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { excludePackageNames } = packageRule;
    if (is.undefined(excludePackageNames)) {
      return null;
    }
    if (!packageName) {
      return false;
    }
    return excludePackageNames.includes(packageName);
  }
}
