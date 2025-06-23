import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { isCustomManager } from '../../modules/manager/custom';
import { matchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class ManagersMatcher extends Matcher {
  override matches(
    { manager }: PackageRuleInputConfig,
    { matchManagers }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchManagers)) {
      return null;
    }
    if (is.undefined(manager) || !manager) {
      return false;
    }
    if (isCustomManager(manager)) {
      return matchRegexOrGlobList(`custom.${manager}`, matchManagers);
    }
    return matchRegexOrGlobList(manager, matchManagers);
  }
}
