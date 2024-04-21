import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class PackagePrefixesMatcher extends Matcher {
  override matches(
    { depName, packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { matchPackagePrefixes } = packageRule;
    if (is.undefined(matchPackagePrefixes)) {
      return null;
    }

    if (!packageName) {
      return false;
    }

    if (
      is.string(packageName) &&
      matchPackagePrefixes.some((prefix) => packageName.startsWith(prefix))
    ) {
      return true;
    }

    return false;
  }

  override excludes(
    { packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { excludePackagePrefixes } = packageRule;
    if (is.undefined(excludePackagePrefixes)) {
      return null;
    }
    if (!packageName) {
      return false;
    }

    if (
      is.string(packageName) &&
      excludePackagePrefixes.some((prefix) => packageName.startsWith(prefix))
    ) {
      return true;
    }

    return false;
  }
}
