import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { matchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

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

    const massagedPatterns = matchPackagePatterns.map((pattern) =>
      pattern === '^*$' || pattern === '*' ? '*' : `/${pattern}/`,
    );
    return matchRegexOrGlobList(packageName, massagedPatterns);
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

    const massagedPatterns = excludePackagePatterns.map((pattern) =>
      pattern === '^*$' || pattern === '*' ? '*' : `/${pattern}/`,
    );
    return matchRegexOrGlobList(packageName, massagedPatterns);
  }
}
