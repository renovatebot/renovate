import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { anyMatchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class UpdateTypesMatcher extends Matcher {
  override matches(
    { updateType, isBump }: PackageRuleInputConfig,
    { matchUpdateTypes }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchUpdateTypes)) {
      return null;
    }
    if (!updateType) {
      return false;
    }
    const toMatch = [updateType];
    if (isBump) {
      toMatch.push('bump');
    }
    return anyMatchRegexOrGlobList(toMatch, matchUpdateTypes);
  }
}
