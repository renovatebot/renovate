import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { regEx } from '../regex';
import { Matcher } from './base';
import { massagePattern } from './utils';

export class PackagePatternsMatcher extends Matcher {
  override matches(
    { depName, packageName }: PackageRuleInputConfig,
    { matchPackagePatterns }: PackageRule
  ): boolean | null {
    if (is.undefined(matchPackagePatterns)) {
      return null;
    }

    if (is.undefined(depName)) {
      return false;
    }

    const namesToMatchAgainst = [depName];

    if (
      is.string(packageName) &&
      process.env.RENOVATE_X_MATCH_PACKAGE_NAMES_MORE
    ) {
      namesToMatchAgainst.push(packageName);
    }

    let isMatch = false;
    for (const packagePattern of matchPackagePatterns) {
      if (
        namesToMatchAgainst.some((p) =>
          isPackagePatternMatch(packagePattern, p)
        )
      ) {
        isMatch = true;
      }
    }
    return isMatch;
  }

  override excludes(
    { depName }: PackageRuleInputConfig,
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

function isPackagePatternMatch(pckPattern: string, pck: string): boolean {
  const re = regEx(massagePattern(pckPattern));
  if (re.test(pck)) {
    logger.trace(`${pck} matches against ${String(re)}`);
    return true;
  }
  return false;
}
