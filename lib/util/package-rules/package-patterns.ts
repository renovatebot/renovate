import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { regEx } from '../regex';
import { Matcher } from './base';
import { massagePattern } from './utils';

export class PackagePatternsMatcher extends Matcher {
  override matches(
    { depName, updateType }: PackageRuleInputConfig,
    { matchPackagePatterns }: PackageRule
  ): boolean | null {
    if (is.undefined(matchPackagePatterns)) {
      return null;
    }

    if (is.undefined(depName)) {
      return false;
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
    if (is.undefined(excludePackagePatterns)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
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
