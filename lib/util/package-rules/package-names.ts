import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { matchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class PackageNameMatcher extends Matcher {
  override matches(
    { packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { matchPackageNames } = packageRule;
    if (is.undefined(matchPackageNames)) {
      return null;
    }
    if (!packageName) {
      return false;
    }
    return matchRegexOrGlobList(packageName, matchPackageNames);
  }
}
