import { isUndefined } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { matchRegexOrGlobList } from '../string-match.ts';
import { Matcher } from './base.ts';

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
