import { isNullOrUndefined, isUndefined } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { Matcher } from './base.ts';

export class IsBreakingMatcher extends Matcher {
  override matches(
    { isBreaking }: PackageRuleInputConfig,
    { matchIsBreaking }: PackageRule,
  ): boolean | null {
    if (isUndefined(matchIsBreaking)) {
      return null;
    }
    if (isNullOrUndefined(isBreaking)) {
      return false;
    }
    return isBreaking === matchIsBreaking;
  }
}
