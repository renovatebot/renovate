import { isNullOrUndefined } from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { anyMatchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class CategoriesMatcher extends Matcher {
  override matches(
    { categories }: PackageRuleInputConfig,
    { matchCategories }: PackageRule,
  ): boolean | null {
    if (isNullOrUndefined(matchCategories)) {
      return null;
    }

    if (isNullOrUndefined(categories)) {
      return false;
    }

    return anyMatchRegexOrGlobList(categories, matchCategories);
  }
}
