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
    if (is.undefined(depName)) {
      return false;
    }

    if (matchPackageNames.includes(depName)) {
      return true;
    }

    if (
      is.string(packageName) &&
      process.env.RENOVATE_X_MATCH_PACKAGE_NAMES_MORE
    ) {
      return matchPackageNames.includes(packageName);
    }

    return false;
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
