import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { configRegexPredicate } from '../regex';
import { Matcher } from './base';

export class BaseBranchesMatcher extends Matcher {
  override matches(
    { baseBranch }: PackageRuleInputConfig,
    { matchBaseBranches }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchBaseBranches)) {
      return null;
    }

    if (is.undefined(baseBranch)) {
      return false;
    }

    return matchBaseBranches.some((matchBaseBranch): boolean => {
      const isAllowedPred = configRegexPredicate(matchBaseBranch);
      if (isAllowedPred) {
        return isAllowedPred(baseBranch);
      }
      return matchBaseBranch === baseBranch;
    });
  }
}
