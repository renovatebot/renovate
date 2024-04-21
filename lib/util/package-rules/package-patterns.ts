import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { regEx } from '../regex';
import { Matcher } from './base';
import { massagePattern } from './utils';

function matchPatternsAgainstName(
  matchPackagePatterns: string[],
  name: string,
): boolean {
  let isMatch = false;
  for (const packagePattern of matchPackagePatterns) {
    if (isPackagePatternMatch(packagePattern, name)) {
      isMatch = true;
    }
  }
  return isMatch;
}

export class PackagePatternsMatcher extends Matcher {
  override matches(
    { packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { matchPackagePatterns } = packageRule;
    if (is.undefined(matchPackagePatterns)) {
      return null;
    }

    if (!packageName) {
      return false;
    }

    return matchPatternsAgainstName(matchPackagePatterns, packageName);
  }

  override excludes(
    { packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { excludePackagePatterns } = packageRule;
    // ignore lockFileMaintenance for backwards compatibility
    if (is.undefined(excludePackagePatterns)) {
      return null;
    }
    if (!packageName) {
      return false;
    }

    return matchPatternsAgainstName(excludePackagePatterns, packageName);
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
