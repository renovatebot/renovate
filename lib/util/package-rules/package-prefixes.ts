import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
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

    if (is.undefined(depName)) {
      return false;
    }

    if (
      is.string(packageName) &&
      matchPackagePrefixes.some((prefix) => packageName.startsWith(prefix))
    ) {
      return true;
    }
    if (matchPackagePrefixes.some((prefix) => depName.startsWith(prefix))) {
      logger.once.warn(
        { packageRule, packageName, depName },
        'Use matchDepPrefixes instead of matchPackagePrefixes',
      );
      return true;
    }

    return false;
  }

  override excludes(
    { depName, packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { excludePackagePrefixes } = packageRule;
    if (is.undefined(excludePackagePrefixes)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }

    if (
      is.string(packageName) &&
      excludePackagePrefixes.some((prefix) => packageName.startsWith(prefix))
    ) {
      return true;
    }
    if (excludePackagePrefixes.some((prefix) => depName.startsWith(prefix))) {
      logger.once.warn(
        { packageRule, packageName, depName },
        'Use excludeDepPrefixes instead of excludePackagePrefixes',
      );
      return true;
    }

    return false;
  }
}
