import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';
import { getCustomManagerList } from '../../modules/manager/custom';

export class ManagersMatcher extends Matcher {
  override matches(
    { manager }: PackageRuleInputConfig,
    { matchManagers }: PackageRule
  ): boolean | null {
    if (is.undefined(matchManagers)) {
      return null;
    }
    if (is.undefined(manager) || !manager) {
      return false;
    }
    // if matchManagers includes 'custom'  match all custom managers
    if (
      getCustomManagerList().includes(manager) &&
      matchManagers.includes('custom')
    ) {
      return true;
    }
    return matchManagers.includes(manager);
  }
}
