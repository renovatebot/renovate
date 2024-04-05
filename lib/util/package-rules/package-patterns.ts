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
    { depName, packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { matchPackagePatterns } = packageRule;
    if (is.undefined(matchPackagePatterns)) {
      return null;
    }

    if (is.undefined(depName)) {
      return false;
    }

    if (
      is.string(packageName) &&
      matchPatternsAgainstName(matchPackagePatterns, packageName)
    ) {
      return true;
    }
    if (matchPatternsAgainstName(matchPackagePatterns, depName)) {
      logger.once.info(
        { packageRule, packageName, depName },
        'Use matchDepPatterns instead of matchPackagePatterns',
      );
      return true;
    }

    return false;
  }

  override excludes(
    { depName, packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { excludePackagePatterns } = packageRule;
    // ignore lockFileMaintenance for backwards compatibility
    if (is.undefined(excludePackagePatterns)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }

    if (
      is.string(packageName) &&
      matchPatternsAgainstName(excludePackagePatterns, packageName)
    ) {
      return true;
    }

    if (matchPatternsAgainstName(excludePackagePatterns, depName)) {
      logger.once.info(
        { packageRule, packageName, depName },
        'Use excludeDepPatterns instead of excludePackagePatterns',
      );
      return true;
    }

    return false;
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
