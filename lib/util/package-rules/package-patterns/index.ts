import is from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { logger } from '../../../logger';
import { regEx } from '../../regex';
import { Matcher } from '../base';

export class PackagePatternsMatcher extends Matcher {
  static readonly id: string = 'packagePatterns';

  override matches(
    { depName, updateType }: PackageRuleInputConfig,
    { matchPackagePatterns }: PackageRule
  ): boolean | null {
    // ignore lockFileMaintenance because for backwards compatibility
    if (
      is.undefined(matchPackagePatterns) ||
      is.undefined(depName) ||
      updateType === 'lockFileMaintenance'
    ) {
      return null;
    }

    let isMatch = false;
    for (const packagePattern of matchPackagePatterns) {
      const packageRegex = regEx(
        packagePattern === '^*$' || packagePattern === '*'
          ? '.*'
          : packagePattern
      );
      if (packageRegex.test(depName)) {
        logger.trace(`${depName} matches against ${String(packageRegex)}`);
        isMatch = true;
      }
    }
    return isMatch;
  }

  override excludes(
    { depName, updateType }: PackageRuleInputConfig,
    { excludePackagePatterns }: PackageRule
  ): boolean | null {
    // ignore lockFileMaintenance because for backwards compatibility
    if (
      is.undefined(excludePackagePatterns) ||
      is.undefined(depName) ||
      updateType === 'lockFileMaintenance'
    ) {
      return null;
    }

    let isMatch = false;
    for (const pattern of excludePackagePatterns) {
      const packageRegex = regEx(
        pattern === '^*$' || pattern === '*' ? '.*' : pattern
      );
      if (packageRegex.test(depName)) {
        logger.trace(`${depName} matches against ${String(packageRegex)}`);
        isMatch = true;
      }
    }
    return isMatch;
  }
}
