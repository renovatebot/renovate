import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class DepTypesMatcher extends Matcher {
  override matches(
    { depTypes, depType }: PackageRuleInputConfig,
    { matchDepTypes }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchDepTypes)) {
      return null;
    }

    const result =
      (is.string(depType) && matchDepTypes.includes(depType)) ||
      depTypes?.some((dt) => matchDepTypes.includes(dt));
    return result ?? false;
  }
}
