import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { Matcher } from './base';

export class PackageNameMatcher extends Matcher {
  override matches(
    { depName, packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { matchPackageNames } = packageRule;
    if (is.undefined(matchPackageNames)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }

    if (is.string(packageName) && matchPackageNames.includes(packageName)) {
      return true;
    }

    if (matchPackageNames.includes(depName)) {
      logger.once.info(
        { packageRule, packageName, depName },
        'Use matchDepNames instead of matchPackageNames',
      );
      return true;
    }

    return false;
  }

  override excludes(
    { depName, packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { excludePackageNames } = packageRule;
    if (is.undefined(excludePackageNames)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }

    if (is.string(packageName) && excludePackageNames.includes(packageName)) {
      return true;
    }

    if (excludePackageNames.includes(depName)) {
      logger.once.info(
        { packageRule, packageName, depName },
        'Use excludeDepNames instead of excludePackageNames',
      );
      return true;
    }

    return false;
  }
}
