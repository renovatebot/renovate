import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class PackagePrefixesMatcher extends Matcher {
  override matches(
    { depName, packageName }: PackageRuleInputConfig,
    { matchPackagePrefixes }: PackageRule
  ): boolean | null {
    if (is.undefined(matchPackagePrefixes)) {
      return null;
    }

    return matchPackagePrefixes.some(
      (prefix) =>
        !!depName?.startsWith(prefix) || !!packageName?.startsWith(prefix)
    );
  }

  override excludes(
    { depName, packageName }: PackageRuleInputConfig,
    { excludePackagePrefixes }: PackageRule
  ): boolean | null {
    if (is.undefined(excludePackagePrefixes)) {
      return null;
    }

    return excludePackagePrefixes.some(
      (prefix) =>
        !!depName?.startsWith(prefix) || !!packageName?.startsWith(prefix)
    );
  }
}
