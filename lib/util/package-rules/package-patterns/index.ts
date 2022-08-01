import is from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { logger } from '../../../logger';
import { regEx } from '../../regex';
import { Matcher } from '../base';
import { massagePattern } from '../utils';

export class PackagePatternsMatcher extends Matcher {
  static readonly id: string = 'package-patterns';

  override matches(
    { depName, updateType }: PackageRuleInputConfig,
    { matchPackagePatterns }: PackageRule
  ): boolean | null {
    // if a pattern is defined but no depName is available for comparison, return false
    // if (is.undefined(depName) && !is.undefined(matchPackagePatterns)) {
    //   return false;
    // }
    if (is.undefined(depName) || is.undefined(matchPackagePatterns)) {
      return null;
    }

    let isMatch = false;
    for (const packagePattern of matchPackagePatterns) {
      const packageRegex = regEx(massagePattern(packagePattern));
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
    // ignore lockFileMaintenance for backwards compatibility
    if (is.undefined(excludePackagePatterns) || is.undefined(depName)) {
      return null;
    }

    let isMatch = false;
    for (const pattern of excludePackagePatterns) {
      const packageRegex = regEx(massagePattern(pattern));
      if (packageRegex.test(depName)) {
        logger.trace(`${depName} matches against ${String(packageRegex)}`);
        isMatch = true;
      }
    }
    return isMatch;
  }
}
