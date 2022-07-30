import is from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { Matcher } from '../base';

export class PackagePrefixesMatcher extends Matcher {
  static readonly id: string = 'packagePrefixes';

  override matches(
    { depName }: PackageRuleInputConfig,
    { matchPackagePrefixes }: PackageRule
  ): boolean | null {
    if (is.undefined(matchPackagePrefixes) || is.undefined(depName)) {
      return null;
    }

    return matchPackagePrefixes.some((prefix) => depName.startsWith(prefix));
  }

  override excludes(
    { depName }: PackageRuleInputConfig,
    { excludePackagePrefixes }: PackageRule
  ): boolean | null {
    if (is.undefined(excludePackagePrefixes) || is.undefined(depName)) {
      return null;
    }

    return excludePackagePrefixes.some((prefix) => depName.startsWith(prefix));
  }
}
