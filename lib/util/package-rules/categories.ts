import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
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

    return matchCategories.some((value) => categories.includes(value));
  }
}
