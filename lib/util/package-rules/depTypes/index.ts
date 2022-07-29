import is from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { Matcher } from '../base';

export class DepTypesMatcher extends Matcher {
  static readonly id: string = 'deptypes';

  override matches(
    { depTypes, depType }: PackageRuleInputConfig,
    { matchDepTypes }: PackageRule
  ): boolean | null {
    if (is.undefined(matchDepTypes) || is.undefined(depType)) {
      return null;
    }

    const result =
      (depType && matchDepTypes.includes(depType)) ||
      depTypes?.some((dt) => matchDepTypes.includes(dt));
    return result ?? false;
  }
}
