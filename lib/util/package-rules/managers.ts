import { isUndefined } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { isCustomManager } from '../../modules/manager/custom/index.ts';
import { matchRegexOrGlobList } from '../string-match.ts';
import { Matcher } from './base.ts';

export class ManagersMatcher extends Matcher {
  override matches(
    { manager }: PackageRuleInputConfig,
    { matchManagers }: PackageRule,
  ): boolean | null {
    if (isUndefined(matchManagers)) {
      return null;
    }
    if (isUndefined(manager) || !manager) {
      return false;
    }
    if (isCustomManager(manager)) {
      return matchRegexOrGlobList(`custom.${manager}`, matchManagers);
    }
    return matchRegexOrGlobList(manager, matchManagers);
  }
}
