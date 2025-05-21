import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { anyMatchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class CategoriesMatcher extends Matcher {
  override matches(
    { categories }: PackageRuleInputConfig,
    { matchCategories }: PackageRule,
  ): boolean | null {
    if (is.nullOrUndefined(matchCategories)) {
      return null;
    }

    if (is.nullOrUndefined(categories)) {
      return false;
    }

    return anyMatchRegexOrGlobList(categories, matchCategories);
  }
}
