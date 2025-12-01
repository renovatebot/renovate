import { isUndefined } from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { matchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class BaseBranchesMatcher extends Matcher {
  override matches(
    { baseBranch }: PackageRuleInputConfig,
    { matchBaseBranches }: PackageRule,
  ): boolean | null {
    if (isUndefined(matchBaseBranches)) {
      return null;
    }

    if (isUndefined(baseBranch)) {
      return false;
    }

    return matchRegexOrGlobList(baseBranch, matchBaseBranches);
  }
}
