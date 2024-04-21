import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { matchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class PackagePrefixesMatcher extends Matcher {
  override matches(
    { packageName }: PackageRuleInputConfig,
    { matchPackagePrefixes }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchPackagePrefixes)) {
      return null;
    }

    if (!packageName) {
      return false;
    }

    const massagedPatterns = matchPackagePrefixes.map(
      (pattern) => `${pattern}**`,
    );
    return matchRegexOrGlobList(packageName, massagedPatterns);
  }

  override excludes(
    { packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { excludePackagePrefixes } = packageRule;
    if (is.undefined(excludePackagePrefixes)) {
      return null;
    }
    if (!packageName) {
      return false;
    }

    const massagedPatterns = excludePackagePrefixes.map(
      (pattern) => `${pattern}**`,
    );
    return matchRegexOrGlobList(packageName, massagedPatterns);
  }
}
