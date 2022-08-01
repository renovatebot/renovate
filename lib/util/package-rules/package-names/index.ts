import is from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { Matcher } from '../base';

export class PackageNameMatcher extends Matcher {
  static readonly id: string = 'package-name';

  override matches(
    { depName }: PackageRuleInputConfig,
    { matchPackageNames }: PackageRule
  ): boolean | null {
    if (is.undefined(matchPackageNames) || is.undefined(depName)) {
      return null;
    }
    return matchPackageNames.includes(depName);
  }

  override excludes(
    { depName }: PackageRuleInputConfig,
    { excludePackageNames }: PackageRule
  ): boolean | null {
    if (is.undefined(excludePackageNames) || is.undefined(depName)) {
      return null;
    }
    return excludePackageNames.includes(depName);
  }
}
