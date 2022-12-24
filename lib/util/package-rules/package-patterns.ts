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

    let isMatch = false;
    for (const packagePattern of matchPackagePatterns) {
      if (
        [depName, packageName].some((p) =>
          isPackagePatternMatch(packagePattern, p)
        )
      ) {
        isMatch = true;
      }
    }
    return isMatch;
  }

  override excludes(
    { depName, packageName }: PackageRuleInputConfig,
    { excludePackagePatterns }: PackageRule
  ): boolean | null {
    // ignore lockFileMaintenance for backwards compatibility
    if (is.undefined(excludePackagePatterns)) {
      return null;
    }

    let isMatch = false;
    for (const packagePattern of excludePackagePatterns) {
      if (
        [depName, packageName].some((p) =>
          isPackagePatternMatch(packagePattern, p)
        )
      ) {
        isMatch = true;
      }
    }
    return isMatch;
  }
}

function isPackagePatternMatch(
  pckPattern: string,
  pck?: string | null
): boolean {
  if (is.nullOrUndefined(pck)) {
    return false;
  }
  const re = regEx(massagePattern(pckPattern));
  if (re.test(pck)) {
    logger.trace(`${pck} matches against ${String(re)}`);
    return true;
  }
  return false;
}
