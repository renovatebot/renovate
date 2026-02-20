import { isUndefined } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { matchRegexOrGlobList } from '../string-match.ts';
import { Matcher } from './base.ts';

export class PackageNameMatcher extends Matcher {
  override matches(
    { packageName }: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null {
    const { matchPackageNames } = packageRule;
    if (isUndefined(matchPackageNames)) {
      return null;
    }
    if (!packageName) {
      return false;
    }
    return matchRegexOrGlobList(packageName, matchPackageNames);
  }
}
