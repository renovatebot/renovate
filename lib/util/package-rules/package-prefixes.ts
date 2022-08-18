import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class PackagePrefixesMatcher extends Matcher {
  override matches(
    { depName }: PackageRuleInputConfig,
    { matchPackagePrefixes }: PackageRule
  ): boolean | null {
    if (is.undefined(matchPackagePrefixes)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }

    return matchPackagePrefixes.some((prefix) => depName.startsWith(prefix));
  }

  override excludes(
    { depName }: PackageRuleInputConfig,
    { excludePackagePrefixes }: PackageRule
  ): boolean | null {
    if (is.undefined(excludePackagePrefixes)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }

    return excludePackagePrefixes.some((prefix) => depName.startsWith(prefix));
  }
}
