import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { Matcher } from './base';

export class PackagePrefixesMatcher extends Matcher {
  override matches(
    { depName, packageName }: PackageRuleInputConfig,
    { matchPackagePrefixes }: PackageRule,
  ): boolean | null {
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
      logger.once.info(
        { packageName, depName },
        'Use matchDepPatterns instead of matchPackagePrefixes',
      );
      return true;
    }

    return false;
  }

  override excludes(
    { depName }: PackageRuleInputConfig,
    { excludePackagePrefixes }: PackageRule,
  ): boolean | null {
    if (is.undefined(excludePackagePrefixes)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }

    return excludePackagePrefixes.some((prefix) => depName.startsWith(prefix));
  }
}
