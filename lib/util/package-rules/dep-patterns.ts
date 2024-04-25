import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { regEx } from '../regex';
import { Matcher } from './base';
import { massagePattern } from './utils';

export class DepPatternsMatcher extends Matcher {
  override matches(
    { depName, updateType }: PackageRuleInputConfig,
    { matchDepPatterns }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchDepPatterns)) {
      return null;
    }

    if (is.undefined(depName)) {
      return false;
    }

    let isMatch = false;
    for (const packagePattern of matchDepPatterns) {
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
    { excludeDepPatterns }: PackageRule,
  ): boolean | null {
    // ignore lockFileMaintenance for backwards compatibility
    if (is.undefined(excludeDepPatterns)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }

    let isMatch = false;
    for (const pattern of excludeDepPatterns) {
      const packageRegex = regEx(massagePattern(pattern));
      if (packageRegex.test(depName)) {
        logger.trace(`${depName} matches against ${String(packageRegex)}`);
        isMatch = true;
      }
    }
    return isMatch;
  }
}
